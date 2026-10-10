from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import json, sqlite3, os, mimetypes
from datetime import datetime, date

ROOT = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(ROOT, "zerowaste.db")
PORT = int(os.environ.get("PORT", "8000"))

def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    return con

def init_db():
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS products(
          id INTEGER PRIMARY KEY AUTOINCREMENT, barcode TEXT UNIQUE NOT NULL,
          sku TEXT, name TEXT NOT NULL, category TEXT DEFAULT 'Grocery',
          price REAL NOT NULL DEFAULT 0, cost REAL NOT NULL DEFAULT 0,
          min_price REAL NOT NULL DEFAULT 0, reorder_point INTEGER DEFAULT 5
        );
        CREATE TABLE IF NOT EXISTS batches(
          id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL,
          batch_code TEXT, expiry TEXT, quantity INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'sellable',
          FOREIGN KEY(product_id) REFERENCES products(id)
        );
        CREATE TABLE IF NOT EXISTS sales(
          id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL,
          cashier TEXT NOT NULL, total REAL NOT NULL, payment_method TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sale_items(
          id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL, batch_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL, unit_price REAL NOT NULL,
          FOREIGN KEY(sale_id) REFERENCES sales(id),
          FOREIGN KEY(product_id) REFERENCES products(id),
          FOREIGN KEY(batch_id) REFERENCES batches(id)
        );
        CREATE TABLE IF NOT EXISTS movements(
          id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL,
          product_id INTEGER NOT NULL, batch_id INTEGER, quantity_delta INTEGER NOT NULL,
          reason TEXT NOT NULL, actor TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS vendors(
          id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
          phone TEXT DEFAULT '', email TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS purchases(
          id INTEGER PRIMARY KEY AUTOINCREMENT, purchased_at TEXT NOT NULL,
          invoice_number TEXT NOT NULL, vendor_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL, batch_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL, unit_cost REAL NOT NULL, total_cost REAL NOT NULL,
          recorded_by TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Recorded',
          FOREIGN KEY(vendor_id) REFERENCES vendors(id),
          FOREIGN KEY(product_id) REFERENCES products(id),
          FOREIGN KEY(batch_id) REFERENCES batches(id)
        );
        CREATE TABLE IF NOT EXISTS discount_decisions(
          id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL,
          original_price REAL NOT NULL, suggested_price REAL NOT NULL,
          discount_percent REAL NOT NULL, status TEXT NOT NULL,
          decided_by TEXT NOT NULL, decided_at TEXT NOT NULL,
          FOREIGN KEY(product_id) REFERENCES products(id)
        );
        """)
        if c.execute("SELECT COUNT(*) FROM products").fetchone()[0] == 0:
            products = [
              ("8901030895014","MILK-1L","Amul Taaza Milk 1L","Dairy",70,54,60,12),
              ("8901725133010","BREAD-01","Whole Wheat Bread","Bakery",45,28,35,8),
              ("8901234567890","RICE-5K","Rice 5kg","Staples",420,340,380,5),
              ("8901058001234","YOG-400","Plain Yogurt 400g","Dairy",55,38,45,8),
              ("8906010500012","BANANA-1K","Banana 1kg","Produce",60,35,45,10),
              ("8904004400019","BISCUIT-01","Digestive Biscuits","Snacks",35,22,28,10),
            ]
            c.executemany("INSERT INTO products(barcode,sku,name,category,price,cost,min_price,reorder_point) VALUES(?,?,?,?,?,?,?,?)", products)
            today = date.today()
            batches = []
            for pid, qty, days, status, code in [
              (1,18,5,"sellable","MLK-A01"), (1,10,18,"sellable","MLK-A02"),
              (2,14,3,"sellable","BRD-B01"), (3,24,240,"sellable","RIC-C01"),
              (4,12,2,"sellable","YOG-D01"), (5,20,4,"sellable","BAN-E01"),
              (6,30,180,"sellable","BIS-F01"), (4,3,1,"quarantined","YOG-D02")
            ]:
                batches.append((pid,code,str(today.replace(day=today.day) if False else date.fromordinal(today.toordinal()+days)),qty,status))
            c.executemany("INSERT INTO batches(product_id,batch_code,expiry,quantity,status) VALUES(?,?,?,?,?)", batches)

def rows(sql, args=()):
    with db() as c:
        return [dict(r) for r in c.execute(sql,args).fetchall()]

def scalar(sql,args=()):
    with db() as c: return c.execute(sql,args).fetchone()[0]

def json_bytes(obj):
    return json.dumps(obj).encode("utf-8")

class Handler(BaseHTTPRequestHandler):
    def send_json(self, data, status=200):
        b=json_bytes(data); self.send_response(status); self.send_header("Content-Type","application/json; charset=utf-8"); self.send_header("Content-Length",str(len(b))); self.send_header("Access-Control-Allow-Origin","*"); self.end_headers(); self.wfile.write(b)
    def body(self):
        n=int(self.headers.get("Content-Length","0"))
        return json.loads(self.rfile.read(n) or b"{}")
    def do_OPTIONS(self):
        self.send_response(204); self.send_header("Access-Control-Allow-Origin","*"); self.send_header("Access-Control-Allow-Headers","Content-Type"); self.send_header("Access-Control-Allow-Methods","GET,POST,OPTIONS"); self.end_headers()
    def do_GET(self):
        path=urlparse(self.path).path
        if path.startswith("/api/"):
            if path=="/api/products":
                self.send_json(rows("""SELECT p.*, COALESCE(SUM(CASE WHEN b.status='sellable' AND b.expiry>=date('now') THEN b.quantity ELSE 0 END),0) sellable
                    FROM products p LEFT JOIN batches b ON b.product_id=p.id GROUP BY p.id ORDER BY p.name""")); return
            if path=="/api/batches":
                self.send_json(rows("""SELECT b.*,p.name,p.barcode FROM batches b JOIN products p ON p.id=b.product_id ORDER BY b.expiry""")); return
            if path=="/api/sales":
                self.send_json(rows("SELECT * FROM sales ORDER BY id DESC LIMIT 30")); return
            if path=="/api/purchases":
                self.send_json(rows("""SELECT pu.*,v.name AS vendor_name,p.name AS product_name,
                    b.batch_code,b.expiry FROM purchases pu JOIN vendors v ON v.id=pu.vendor_id
                    JOIN products p ON p.id=pu.product_id JOIN batches b ON b.id=pu.batch_id
                    ORDER BY pu.id DESC LIMIT 200""")); return
            if path=="/api/vendors":
                self.send_json(rows("SELECT * FROM vendors ORDER BY name")); return
            if path=="/api/dashboard":
                self.send_json({
                  "products":scalar("SELECT COUNT(*) FROM products"),
                  "sellable":scalar("SELECT COALESCE(SUM(quantity),0) FROM batches WHERE status='sellable' AND expiry>=date('now')"),
                  "expiring":scalar("SELECT COUNT(*) FROM batches WHERE status='sellable' AND expiry BETWEEN date('now') AND date('now','+7 days') AND quantity>0"),
                  "sales":round(scalar("SELECT COALESCE(SUM(total),0) FROM sales WHERE date(created_at)=date('now','localtime')"),2),
                  "profit":round(scalar("""SELECT COALESCE(SUM((si.unit_price-p.cost)*si.quantity),0)
                    FROM sale_items si JOIN sales s ON s.id=si.sale_id
                    JOIN products p ON p.id=si.product_id
                    WHERE date(s.created_at)=date('now','localtime')"""),2),
                  "waste":scalar("SELECT COALESCE(SUM(-quantity_delta),0) FROM movements WHERE quantity_delta<0 AND reason IN ('waste','damage','disposal')"),
                  "lowstock":scalar("""SELECT COUNT(*) FROM (SELECT p.id FROM products p LEFT JOIN batches b ON b.product_id=p.id AND b.status='sellable' AND b.expiry>=date('now') GROUP BY p.id HAVING COALESCE(SUM(b.quantity),0)<=p.reorder_point)""")
                }); return
            if path=="/api/agents":
                products=rows("""SELECT p.id,p.name,p.price,p.cost,p.min_price,p.reorder_point,
                  COALESCE(SUM(CASE WHEN b.status='sellable' AND b.expiry>=date('now') THEN b.quantity ELSE 0 END),0) stock,
                  MIN(CASE WHEN b.status='sellable' AND b.quantity>0 THEN b.expiry END) expiry
                  FROM products p LEFT JOIN batches b ON b.product_id=p.id GROUP BY p.id""")
                result=[]
                for p in products:
                    if p["expiry"]:
                        days=(date.fromisoformat(p["expiry"])-date.today()).days
                        if 0<=days<=7:
                            sold=scalar("SELECT COALESCE(SUM(si.quantity),0) FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE si.product_id=(SELECT id FROM products WHERE name=?) AND date(s.created_at)>=date('now','-5 days') AND s.cashier='DEMO DATA'",(p["name"],))
                            avg_daily=round(sold/5,1)
                            stock=int(p["stock"])
                            urgency="High" if days<=3 else "Medium"
                            if days<=1: action="Manager: prioritize this batch today; verify expiry and food-safety rules. Apply a markdown only if margin permits; review unsold stock before expiry."
                            elif days<=3 and avg_daily>0 and stock>avg_daily*days: action=f"Manager: consider a 10–15% markdown if price stays above the approved margin floor. Demo sell-through estimate: about {avg_daily:.1f} units/day versus {stock} units in stock."
                            elif days<=3: action="Manager: feature this batch first and monitor sell-through today. Consider a margin-safe markdown if sales are slower than expected."
                            else: action="Monitor daily sell-through. If projected demand is below the batch quantity, prepare a 5–10% markdown after checking the margin floor."
                            # Suggest a discount only when the recorded cost/minimum-price floor allows it.
                            floor=max(float(p.get("cost") or 0), float(p.get("min_price") or 0), 0.0)
                            suggested_pct=15 if days<=2 else (10 if days<=4 else 5)
                            raw_price=round(float(p["price"])*(1-suggested_pct/100),2)
                            suggested_price=round(max(raw_price,floor),2)
                            actual_pct=round((float(p["price"])-suggested_price)/float(p["price"])*100,1) if p["price"] else 0
                            discount_ok=bool(actual_pct>0 and suggested_price>=floor and suggested_price<float(p["price"]))
                            if discount_ok:
                                action=f"Recommend {actual_pct:g}% markdown: {p['price']:.2f} → ₹{suggested_price:.2f}. Unit cost floor is ₹{floor:.2f}; manager approval required. Review sell-through after markdown."
                            else:
                                action=f"No margin-safe markdown available from recorded cost ₹{floor:.2f} and price ₹{p['price']:.2f}. Prioritize display/sell-through and ask manager to review vendor cost or other waste-prevention options."
                            result.append({"agent":"Expiry Prevention","priority":urgency,"product":p["name"],"finding":f"Eligible batch expires in {days} day(s). Sellable stock: {stock}. Demo recent sales average: {avg_daily:.1f} units/day.","action":action,"type":"expiry","product_id":p.get("id"),"original_price":float(p["price"]),"suggested_price":suggested_price,"discount_percent":actual_pct,"unit_cost":floor,"discount_available":discount_ok})
                    if p["stock"]>0 and p["price"]>0:
                        margin=round((p["price"]-p["cost"])/p["price"]*100,1)
                        if margin<15: result.append({"agent":"Profit Optimization","priority":"Medium","product":p["name"],"finding":f"Recorded gross margin is {margin}% based on current unit price and cost.","action":"Review vendor cost and discount floor before markdowns.","type":"margin"})
                    if p["stock"]<=p["reorder_point"]: result.append({"agent":"Inventory Optimization","priority":"High","product":p["name"],"finding":f"Sellable stock is {p['stock']}; reorder point is {p['reorder_point']}.","action":f"Reorder at least {max(0, int(p['reorder_point'])-int(p['stock']))} unit(s) to return to the reorder point. This is a minimum top-up, not a demand-based order forecast; confirm supplier pack size and lead time.","type":"stock","product_id":p.get("id"),"stock":int(p["stock"]),"reorder_point":int(p["reorder_point"]),"suggested_reorder_qty":max(0, int(p["reorder_point"])-int(p["stock"]))})
                    if p["stock"]>0 and p["price"]>0: pass
                demo_sales=scalar("SELECT COUNT(*) FROM sales WHERE cashier='DEMO DATA' AND payment_method='DEMO'")
                recent_units=scalar("SELECT COALESCE(SUM(si.quantity),0) FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE date(s.created_at)>=date('now','-7 days')")
                daily_units=round(float(recent_units or 0)/7,1)
                forecast_finding=(f"{recent_units} units sold in the last 7 days (about {daily_units:.1f}/day). " + (f"{demo_sales} labelled demo sales are included, so treat this as simulated data." if demo_sales else "Based on recorded POS sales; a short history may be noisy.")) if recent_units else (f"{demo_sales} labelled demo sales records are available, but no units were sold in the last 7 days." if demo_sales else "No recent sales history is available, so a numeric demand forecast would be unreliable.")
                forecast_action=(f"Planning estimate only: at the recent average, expect about {round(daily_units*7)} units over the next 7 days if demand stays similar. Compare against sellable stock and supplier lead time; do not treat demo sales as real demand." if recent_units else "Record POS sales or load labelled demo data before using a numeric forecast. This starter does not train a machine-learning forecasting model.")
                result.append({"agent":"Demand Forecast","priority":"Low","product":"Store-wide","finding":forecast_finding,"action":forecast_action,"type":"forecast"})
                result.append({"agent":"Store Transfer","priority":"Low","product":"Store-wide","finding":"No multi-store inventory is configured in this starter.","action":"Transfer suggestions are unavailable until at least two stores and their stock levels are configured; no transfer is being assumed.","type":"transfer"})
                urgent=[x for x in result if x.get("type")=="expiry" and x.get("priority")=="High"]
                low=[x for x in result if x.get("type")=="stock" and x.get("suggested_reorder_qty",0)>0]
                coordinator_bits=[]
                if urgent: coordinator_bits.append(f"{len(urgent)} high-priority expiry item(s): " + ", ".join(x["product"] for x in urgent[:3]))
                if low: coordinator_bits.append(f"{len(low)} product(s) need replenishment; largest listed top-up is {max(x['suggested_reorder_qty'] for x in low)} unit(s)")
                coord_action="; ".join(coordinator_bits) if coordinator_bits else "No high-priority expiry or below-reorder-point signals detected. Continue daily stock and expiry checks."
                result.append({"agent":"Decision Coordinator","priority":"High" if urgent or low else "Low","product":"Store-wide","finding":f"Reviewed {len(result)} operational signals. " + (" ".join(coordinator_bits) if coordinator_bits else "No urgent expiry or replenishment action is currently flagged."),"action":"Suggested review order: " + coord_action + ". Manager should verify batch safety, margins, and supplier lead times before acting.","type":"coordinator"})
                self.send_json(result); return
            if path=="/api/lookup":
                import urllib.parse
                code=urllib.parse.parse_qs(urlparse(self.path).query).get("barcode",[""])[0]
                p=rows("SELECT * FROM products WHERE barcode=? OR sku=?",(code,code))
                if not p: self.send_json({"error":"Product not found. Ask inventory staff to register this barcode."},404); return
                product=p[0]
                batches=rows("""SELECT * FROM batches WHERE product_id=? AND status='sellable' AND expiry>=date('now') AND quantity>0 ORDER BY expiry,id""",(product["id"],))
                stock=sum(x["quantity"] for x in batches)
                if stock<=0: self.send_json({"error":"No eligible sellable stock is available for this product."},409); return
                product["sellable"]=stock; self.send_json(product); return
            self.send_json({"error":"Unknown API endpoint"},404); return
        if path=="/": path="/static/index.html"
        f=os.path.abspath(os.path.join(ROOT, path.lstrip("/")))
        if not f.startswith(ROOT) or not os.path.isfile(f):
            self.send_response(404); self.end_headers(); return
        typ=mimetypes.guess_type(f)[0] or "application/octet-stream"
        data=open(f,"rb").read(); self.send_response(200); self.send_header("Content-Type",typ); self.send_header("Content-Length",str(len(data))); self.end_headers(); self.wfile.write(data)
    def do_POST(self):
        path=urlparse(self.path).path
        try: data=self.body()
        except Exception: self.send_json({"error":"Invalid JSON body"},400); return
        if path=="/api/discount-decision":
            role=data.get("role")
            if role not in ("Manager", "Owner/Admin"):
                self.send_json({"error":"Only Manager or Owner/Admin can approve or reject discounts."},403); return
            try:
                product_id=int(data.get("product_id",0)); decision=str(data.get("decision","" )).lower()
                if decision not in ("approve","reject"): raise ValueError("Choose approve or reject.")
                with db() as c:
                    p=c.execute("SELECT id,name,price,cost,min_price FROM products WHERE id=?",(product_id,)).fetchone()
                    if not p: raise ValueError("Product not found.")
                    original=float(data.get("original_price",p["price"]))
                    suggested=float(data.get("suggested_price",p["price"]))
                    pct=float(data.get("discount_percent",0))
                    floor=max(float(p["cost"] or 0),float(p["min_price"] or 0))
                    if decision=="approve":
                        if suggested<floor or suggested>=original: raise ValueError("Discount violates the recorded cost/minimum-price floor.")
                        c.execute("UPDATE products SET price=? WHERE id=?",(suggested,product_id))
                        status="Approved"
                    else: status="Rejected"
                    c.execute("INSERT INTO discount_decisions(product_id,original_price,suggested_price,discount_percent,status,decided_by,decided_at) VALUES(?,?,?,?,?,?,?)",(product_id,original,suggested,pct,status,role,datetime.now().isoformat(timespec="seconds")))
                self.send_json({"ok":True,"message":f"Discount {status.lower()}." + (" POS price updated." if decision=="approve" else " Product price unchanged.")})
            except (ValueError,TypeError) as e: self.send_json({"error":str(e)},400)
            return
        if path=="/api/demo-data":
            role=data.get("role")
            if role not in ("Manager", "Owner/Admin"):
                self.send_json({"error":"Only Manager or Owner/Admin can load demo data."},403); return
            try:
                with db() as c:
                    if c.execute("SELECT COUNT(*) FROM sales WHERE cashier='DEMO DATA' AND payment_method='DEMO' ").fetchone()[0] > 0:
                        self.send_json({"ok":True,"already_loaded":True,"message":"Demo sales data is already loaded. No duplicate rows were added."}); return
                    # Historical demo sales create a realistic velocity signal. Existing inventory quantities are deliberately untouched.
                    sku_rows={r['sku']:r for r in c.execute("SELECT * FROM products").fetchall()}
                    patterns=[
                      ("MILK-1L",[(5,6),(4,5),(3,7),(2,4),(1,6)]),
                      ("BREAD-01",[(5,3),(4,4),(3,5),(2,4),(1,5)]),
                      ("YOG-400",[(5,4),(4,5),(3,3),(2,6),(1,5)]),
                      ("BANANA-1K",[(5,5),(4,6),(3,4),(2,7),(1,6)]),
                    ]
                    today=date.today()
                    for sku,day_counts in patterns:
                        p=sku_rows.get(sku)
                        if not p: continue
                        batch=c.execute("SELECT id FROM batches WHERE product_id=? ORDER BY expiry LIMIT 1",(p['id'],)).fetchone()
                        if not batch: continue
                        for days_ago,qty in day_counts:
                            created=datetime.combine(date.fromordinal(today.toordinal()-days_ago),datetime.min.time()).replace(hour=10+days_ago%7).isoformat(timespec="seconds")
                            total=round(float(p['price'])*qty,2)
                            cur=c.execute("INSERT INTO sales(created_at,cashier,total,payment_method) VALUES(?,?,?,?)",(created,"DEMO DATA",total,"DEMO"))
                            c.execute("INSERT INTO sale_items(sale_id,product_id,batch_id,quantity,unit_price) VALUES(?,?,?,?,?)",(cur.lastrowid,p['id'],batch['id'],qty,p['price']))
                self.send_json({"ok":True,"message":"Demo sales history loaded. Existing products, batches and quantities were not changed."})
            except Exception as e: self.send_json({"error":str(e)},400)
            return
        if path=="/api/products":
            role=data.get("role")
            if role not in ("Manager","Inventory Employee","Owner/Admin"): self.send_json({"error":"Only authorized inventory staff can register products."},403); return
            try:
                with db() as c:
                    c.execute("INSERT INTO products(barcode,sku,name,category,price,cost,min_price,reorder_point) VALUES(?,?,?,?,?,?,?,?)",
                     (data["barcode"].strip(),data.get("sku",""),data["name"].strip(),data.get("category","Grocery"),float(data["price"]),float(data.get("cost",0)),float(data.get("min_price",0)),int(data.get("reorder_point",5))))
                    pid=c.execute("SELECT last_insert_rowid()").fetchone()[0]
                    c.execute("INSERT INTO batches(product_id,batch_code,expiry,quantity,status) VALUES(?,?,?,?,?)",(pid,data.get("batch_code","OPENING"),data.get("expiry"),int(data.get("quantity",0)),"sellable"))
                self.send_json({"ok":True})
            except sqlite3.IntegrityError: self.send_json({"error":"Barcode already exists, or required data is invalid."},400)
            except Exception as e: self.send_json({"error":str(e)},400)
            return
        if path=="/api/purchases":
            role=data.get("role")
            if role not in ("Manager", "Inventory Employee", "Owner/Admin"):
                self.send_json({"error":"Only authorized inventory staff can record purchases."},403); return
            try:
                vendor_name=str(data.get("vendor_name","")).strip()
                invoice=str(data.get("invoice_number","")).strip()
                code=str(data.get("barcode","")).strip()
                qty=int(data.get("quantity",0)); unit_cost=float(data.get("unit_cost",-1))
                expiry=str(data.get("expiry","")).strip()
                if not vendor_name or not invoice or not code: raise ValueError("Vendor, invoice number, and product are required.")
                if qty < 1: raise ValueError("Quantity must be at least one.")
                if unit_cost < 0: raise ValueError("Purchase cost cannot be negative.")
                try: date.fromisoformat(expiry)
                except Exception: raise ValueError("Enter the batch expiry date in YYYY-MM-DD format.")
                now=datetime.now().isoformat(timespec="seconds")
                batch_code=str(data.get("batch_code","")).strip() or ("INV-"+invoice)
                with db() as c:
                    p=c.execute("SELECT * FROM products WHERE barcode=? OR sku=?",(code,code)).fetchone()
                    if not p: raise ValueError("Product not found. Register it in Inventory first.")
                    c.execute("INSERT INTO vendors(name) VALUES(?) ON CONFLICT(name) DO NOTHING",(vendor_name,))
                    vendor=c.execute("SELECT id FROM vendors WHERE name=?",(vendor_name,)).fetchone()
                    cur=c.execute("INSERT INTO batches(product_id,batch_code,expiry,quantity,status) VALUES(?,?,?,?, 'sellable')",(p["id"],batch_code,expiry,qty))
                    total=round(qty*unit_cost,2)
                    c.execute("INSERT INTO purchases(purchased_at,invoice_number,vendor_id,product_id,batch_id,quantity,unit_cost,total_cost,recorded_by) VALUES(?,?,?,?,?,?,?,?,?)",(now,invoice,vendor["id"],p["id"],cur.lastrowid,qty,unit_cost,total,str(data.get("actor") or role)))
                    c.execute("UPDATE products SET cost=? WHERE id=?",(unit_cost,p["id"]))
                    c.execute("INSERT INTO movements(created_at,product_id,batch_id,quantity_delta,reason,actor) VALUES(?,?,?,?,?,?)",(now,p["id"],cur.lastrowid,qty,"vendor purchase · invoice "+invoice,str(data.get("actor") or role)))
                self.send_json({"ok":True,"message":"Vendor purchase recorded and stock batch created.","purchase_cost":total,"batch_id":cur.lastrowid})
            except ValueError as e: self.send_json({"error":str(e)},400)
            except Exception as e: self.send_json({"error":str(e)},400)
            return
        if path=="/api/restock":
            role=data.get("role")
            if role not in ("Manager", "Inventory Employee", "Owner/Admin"):
                self.send_json({"error":"Only authorized inventory staff can restock products."},403); return
            try:
                code=str(data.get("barcode", data.get("sku", ""))).strip()
                qty=int(data.get("quantity", 0))
                expiry=str(data.get("expiry", "")).strip()
                if not code: raise ValueError("Choose an existing product.")
                if qty < 1: raise ValueError("Quantity must be at least one.")
                try: date.fromisoformat(expiry)
                except Exception: raise ValueError("Enter the batch expiry date in YYYY-MM-DD format.")
                with db() as c:
                    p=c.execute("SELECT * FROM products WHERE barcode=? OR sku=?",(code,code)).fetchone()
                    if not p: raise ValueError("Product not found. Register it before restocking.")
                    cost=data.get("cost")
                    if cost not in (None, ""):
                        c.execute("UPDATE products SET cost=? WHERE id=?",(float(cost),p["id"]))
                    batch_code=str(data.get("batch_code") or ("RESTOCK-"+datetime.now().strftime("%Y%m%d%H%M%S"))).strip()
                    cur=c.execute("INSERT INTO batches(product_id,batch_code,expiry,quantity,status) VALUES(?,?,?,?, 'sellable')",(p["id"],batch_code,expiry,qty))
                    c.execute("INSERT INTO movements(created_at,product_id,batch_id,quantity_delta,reason,actor) VALUES(?,?,?,?,?,?)",(datetime.now().isoformat(timespec="seconds"),p["id"],cur.lastrowid,qty,"restock",data.get("actor",role)))
                self.send_json({"ok":True,"message":"Stock added successfully.","product_id":p["id"],"quantity_added":qty})
            except ValueError as e: self.send_json({"error":str(e)},400)
            except Exception as e: self.send_json({"error":str(e)},400)
            return
        if path=="/api/checkout":
            items=data.get("items",[])
            if not items: self.send_json({"error":"Scan at least one product before checkout."},400); return
            role=data.get("role","Cashier")
            if role not in ("Cashier","Manager","Owner/Admin"): self.send_json({"error":"This role cannot perform checkout."},403); return
            payment=data.get("payment_method","UPI")
            try:
                with db() as c:
                    c.execute("BEGIN IMMEDIATE")
                    validated=[]; total=0.0
                    for item in items:
                        pid=int(item["product_id"]); qty=int(item["quantity"])
                        if qty<1: raise ValueError("Quantity must be at least one.")
                        p=c.execute("SELECT * FROM products WHERE id=?",(pid,)).fetchone()
                        if not p: raise ValueError("Product not found.")
                        batches=c.execute("""SELECT * FROM batches WHERE product_id=? AND status='sellable' AND expiry>=date('now') AND quantity>0 ORDER BY expiry,id""",(pid,)).fetchall()
                        avail=sum(b["quantity"] for b in batches)
                        if qty>avail: raise ValueError(f"Not enough eligible stock for {p['name']}. Available: {avail}.")
                        validated.append((p,qty,batches)); total+=p["price"]*qty
                    cur=c.execute("INSERT INTO sales(created_at,cashier,total,payment_method) VALUES(?,?,?,?)",(datetime.now().isoformat(timespec="seconds"),data.get("cashier","Cashier"),round(total,2),payment))
                    sale_id=cur.lastrowid
                    for p,qty,batches in validated:
                        left=qty
                        for b in batches:
                            take=min(left,b["quantity"])
                            if take:
                                c.execute("UPDATE batches SET quantity=quantity-? WHERE id=? AND quantity>=?",(take,b["id"],take))
                                if c.total_changes < 1: raise ValueError("Stock changed during checkout; please retry.")
                                c.execute("INSERT INTO sale_items(sale_id,product_id,batch_id,quantity,unit_price) VALUES(?,?,?,?,?)",(sale_id,p["id"],b["id"],take,p["price"]))
                                c.execute("INSERT INTO movements(created_at,product_id,batch_id,quantity_delta,reason,actor) VALUES(?,?,?,?,?,?)",(datetime.now().isoformat(timespec="seconds"),p["id"],b["id"],-take,"sale",data.get("cashier","Cashier")))
                                left-=take
                            if not left: break
                    c.commit()
                self.send_json({"ok":True,"sale_id":sale_id,"total":round(total,2)})
            except Exception as e: self.send_json({"error":str(e)},409)
            return
        if path=="/api/batch-expiry":
            role=data.get("role")
            if role not in ("Manager", "Inventory Employee", "Owner/Admin"):
                self.send_json({"error":"Only authorized inventory staff can edit batch expiry dates."},403); return
            try:
                batch_id=int(data.get("batch_id"))
                expiry=str(data.get("expiry", "")).strip()
                try: date.fromisoformat(expiry)
                except Exception: raise ValueError("Enter the expiry date in YYYY-MM-DD format.")
                with db() as c:
                    b=c.execute("SELECT * FROM batches WHERE id=?",(batch_id,)).fetchone()
                    if not b: raise ValueError("Batch not found.")
                    c.execute("UPDATE batches SET expiry=? WHERE id=?",(expiry,batch_id))
                    c.execute("INSERT INTO movements(created_at,product_id,batch_id,quantity_delta,reason,actor) VALUES(?,?,?,?,?,?)",(datetime.now().isoformat(timespec="seconds"),b["product_id"],batch_id,0,"expiry date corrected",data.get("actor",role)))
                self.send_json({"ok":True,"message":"Batch expiry date updated. Quantity unchanged."})
            except ValueError as e: self.send_json({"error":str(e)},400)
            except Exception as e: self.send_json({"error":str(e)},400)
            return
        if path=="/api/adjust":
            if data.get("role") not in ("Manager","Inventory Employee","Owner/Admin"): self.send_json({"error":"Not authorized."},403); return
            try:
                with db() as c:
                    b=c.execute("SELECT * FROM batches WHERE id=?",(int(data["batch_id"]),)).fetchone()
                    if not b: raise ValueError("Batch not found.")
                    q=int(data["quantity"])
                    if q<0: raise ValueError("Quantity cannot be negative.")
                    c.execute("UPDATE batches SET quantity=? WHERE id=?",(q,b["id"]))
                    c.execute("INSERT INTO movements(created_at,product_id,batch_id,quantity_delta,reason,actor) VALUES(?,?,?,?,?,?)",(datetime.now().isoformat(timespec="seconds"),b["product_id"],b["id"],q-b["quantity"],data.get("reason","count adjustment"),data.get("actor","Inventory Employee")))
                self.send_json({"ok":True})
            except Exception as e: self.send_json({"error":str(e)},400)
            return
        self.send_json({"error":"Unknown API endpoint"},404)

if __name__=="__main__":
    init_db()
    print(f"ZeroWaste AI running at http://localhost:{PORT}")
    print("Demo roles: Manager, Inventory Employee, Cashier, Owner/Admin")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
