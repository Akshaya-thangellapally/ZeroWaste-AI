const $ = s => document.querySelector(s);
let role = "Manager", page = "dashboard", cart = [], products = [], batches = [], toastTimer;
const money = n => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(n)||0);
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(path, opts={}) {
  const r=await fetch(path,{headers:{"Content-Type":"application/json"},...opts});
  const d=await r.json(); if(!r.ok) throw new Error(d.error||"Request failed"); return d;
}
function toast(s){const t=$("#toast");t.textContent=s;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),3000)}
function canManage(){return ["Manager","Owner/Admin"].includes(role)}
function canInventory(){return ["Manager","Inventory Employee","Owner/Admin"].includes(role)}
function setRole(){
 role=$("#role").value; $("#avatar").textContent=role[0]; 
 document.querySelectorAll(".nav").forEach(b=>{
   const p=b.dataset.page;
   b.classList.toggle("hidden", (role==="Cashier" && !["pos"].includes(p)) || (role==="Inventory Employee" && !["inventory","purchases"].includes(p)) || (role==="Owner/Admin" && !["inventory","purchases"].includes(p)));
 });
 if(role==="Cashier") go("pos"); else if(role==="Inventory Employee"||role==="Owner/Admin") go("inventory"); else go("dashboard");
}
function go(p){
 page=p;
 document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.page===p));
 const titles={dashboard:["STORE OVERVIEW","Good evening."],pos:["POINT OF SALE","Ready to scan."],inventory:["INVENTORY DATA","Stock, at a glance."],agents:["AI INTELLIGENCE","Signals worth a look."],sales:["TRANSACTIONS","Recent store sales."],purchases:["PURCHASING","Vendor invoices and received stock."]};
 $("#crumb").textContent=(titles[p]||titles.dashboard)[0]; $("#page-title").textContent=(titles[p]||titles.dashboard)[1];
 if((p==="dashboard"||p==="agents"||p==="sales"||p==="purchases")&&!canManage()&&!canInventory()){toast("This page is restricted for your role.");go(role==="Cashier"?"pos":"inventory");return}
 if(p==="inventory"&&!canInventory()){toast("Inventory access is restricted.");go("pos");return}
 render();
}
async function render(){
 $("#content").innerHTML='<div class="loading">Loading store data…</div>';
 try{
  if(page==="dashboard") await dashboard();
  if(page==="pos") await pos();
  if(page==="inventory") await inventory();
  if(page==="agents") await agents();
  if(page==="sales") await sales();
  if(page==="purchases") await purchases();
 }catch(e){$("#content").innerHTML=`<div class="card"><h2>Could not load this screen</h2><p class="muted">${esc(e.message)}</p><button class="btn" onclick="render()">Try again</button></div>`}
}
async function dashboard(){
 const d=await api("/api/dashboard"), a=await api("/api/agents");
 $("#content").innerHTML=`
 <div class="grid metrics">
  <div class="card tint-mint"><div class="metric-label">Active products</div><div class="metric-value">${d.products}</div><div class="metric-note">Registered product records</div></div>
  <div class="card tint-lime"><div class="metric-label">Sellable units</div><div class="metric-value">${d.sellable}</div><div class="metric-note">Excludes quarantined and expired stock</div></div>
  <div class="card tint-butter"><div class="metric-label">Expiry watch</div><div class="metric-value">${d.expiring}</div><div class="metric-note">Batches expiring in 7 days</div></div>
  <div class="card tint-lav"><div class="metric-label">Today's sales</div><div class="metric-value">${money(d.sales)}</div><div class="metric-note">Recorded POS sales</div></div>
  <div class="card tint-mint"><div class="metric-label">Today's estimated profit</div><div class="metric-value">${money(d.profit)}</div><div class="metric-note">Sales minus recorded product cost</div></div>
 </div>
 <div class="grid two-col">
  <div class="card"><div class="section-head" style="margin-top:0"><div><h2>Priority signals</h2><p>Rule-based signals from current demo inventory</p></div><button class="btn secondary" onclick="go('agents')">View AI team</button></div>
   <div class="list">${a.slice(0,4).map(x=>`<div class="list-row"><div><strong>${esc(x.product)}</strong><div class="muted">${esc(x.finding)}</div></div><span class="pill ${x.priority.toLowerCase()}">${esc(x.priority)}</span></div>`).join("")}</div>
  </div>
  <div class="card tint-blush"><h2>Barcode-first billing</h2><p class="subtitle">Scan products, auto-add items, allocate eligible stock by FEFO, and complete checkout in one flow.</p><div style="font-size:42px;margin:22px 0 12px">▥</div><button class="btn" onclick="go('pos')">Open POS billing →</button><p class="hint" style="margin-top:13px">USB/Bluetooth scanners that type barcodes are supported. Camera scanning is not enabled in this starter.</p></div>
 </div>
 <div class="grid three-col" style="margin-top:15px">
  <div class="card"><div class="metric-label">Low-stock products</div><div class="metric-value">${d.lowstock}</div><div class="metric-note">At or below reorder point</div></div>
  <div class="card"><div class="metric-label">Recorded waste units</div><div class="metric-value">${d.waste}</div><div class="metric-note">Based on recorded waste movements</div></div>
  <div class="card"><div class="metric-label">AI agents</div><div class="metric-value">05</div><div class="metric-note">Starter uses transparent rules, not an external AI model</div></div>
 </div>
 <div class="warning">Demo environment: seeded products and inventory are illustrative. Sales, waste, and impact metrics only reflect records created in this local database.</div>`;
}
async function pos(){
 products=await api("/api/products");
 $("#content").innerHTML=`
 <div class="grid two-col">
  <div class="scan-card">
   <div class="section-head" style="margin-top:0"><div><h2>Scan a product</h2><p>Keep the cursor in the barcode field while scanning.</p></div><span class="scanner-icon">▥</span></div>
   <label class="label" for="barcode-input">BARCODE / SKU</label>
   <input id="barcode-input" class="search scan-input" placeholder="Scan barcode or type demo barcode…" autocomplete="off" autofocus>
   <div id="scan-status" class="scan-status">Scanner ready · USB/Bluetooth scanners can type directly here.</div>
   <div class="hint" style="margin-top:12px">Try demo barcode <strong>8901030895014</strong> (milk), or use the Inventory page to view all registered barcodes.</div>
   <div class="section-head"><div><h2>Quick add</h2><p>Fallback when a scanner isn't available.</p></div></div>
   <input id="product-search" class="search" placeholder="Search product name or barcode…">
   <div id="quick-products" class="list"></div>
  </div>
  <div class="card">
   <div class="section-head" style="margin-top:0"><div><h2>Current bill</h2><p id="cart-count">0 items</p></div><button class="btn secondary" id="clear-cart">Clear</button></div>
   <div id="cart-lines"></div>
   <div class="total-line"><span>Subtotal</span><strong id="subtotal">${money(0)}</strong></div>
   <div class="total-line"><span>Discounts</span><span>₹0.00</span></div>
   <div class="total-line final"><span>Total payable</span><span id="total">${money(0)}</span></div>
   <div class="field" style="margin-top:16px"><label>Payment method</label><select id="payment"><option>UPI</option><option>Cash</option><option>Card</option></select></div>
   <button class="btn" id="checkout" style="width:100%;margin-top:14px;padding:14px" disabled>Complete checkout</button>
   <p class="hint" style="margin-top:11px">Stock is revalidated on the server. Eligible batches are allocated by earliest expiry first. Checkout is transactional.</p>
  </div>
 </div>`;
 const input=$("#barcode-input");
 input.addEventListener("keydown", async e=>{if(e.key==="Enter"){e.preventDefault();const code=input.value.trim();input.value="";if(code) await scan(code);input.focus()}});
 $("#product-search").addEventListener("input",quickProducts);
 $("#clear-cart").onclick=()=>{cart=[];drawCart();input.focus()};
 $("#checkout").onclick=checkout;
 quickProducts();drawCart();input.focus();
}
async function scan(code){
 const status=$("#scan-status");status.textContent=`Looking up ${code}…`;
 try{
  const p=await api(`/api/lookup?barcode=${encodeURIComponent(code)}`);
  const existing=cart.find(x=>x.id===p.id);
  const count=existing?existing.quantity+1:1;
  if(count>p.sellable) throw new Error(`Only ${p.sellable} eligible unit(s) available.`);
  if(existing) existing.quantity++; else cart.push({id:p.id,barcode:p.barcode,name:p.name,price:p.price,quantity:1,sellable:p.sellable});
  status.innerHTML=`<span style="color:#28613a">✓ Added ${esc(p.name)} · ${money(p.price)}</span>`;
  drawCart();toast(`${p.name} added`);
 }catch(e){status.innerHTML=`<span style="color:#9a4630">⚠ ${esc(e.message)}</span>`;toast(e.message)}
}
function quickProducts(){
 const q=($("#product-search")?.value||"").toLowerCase();
 const el=$("#quick-products"); if(!el)return;
 const matches=products.filter(p=>p.name.toLowerCase().includes(q)||p.barcode.includes(q)||String(p.sku||"").toLowerCase().includes(q)).slice(0,5);
 el.innerHTML=matches.map(p=>`<div class="list-row"><div><strong>${esc(p.name)}</strong><div class="muted">${esc(p.barcode)} · ${p.sellable} sellable</div></div><div class="right"><strong>${money(p.price)}</strong><br><button class="btn secondary" style="padding:5px 10px;margin-top:5px" onclick="scan('${esc(p.barcode)}')">Add</button></div></div>`).join("")||'<div class="empty">No matching products.</div>';
}
function drawCart(){
 const el=$("#cart-lines");if(!el)return;
 el.innerHTML=cart.map(x=>`<div class="cart-row"><div><strong>${esc(x.name)}</strong><div class="muted">${money(x.price)} each</div></div><input type="number" min="1" max="${x.sellable}" value="${x.quantity}" aria-label="Quantity for ${esc(x.name)}" onchange="setQty(${x.id},this.value)"><strong class="right">${money(x.price*x.quantity)}</strong><button class="remove" onclick="removeItem(${x.id})" aria-label="Remove item">×</button></div>`).join("")||'<div class="empty">No items yet. Scan a barcode to begin.</div>';
 const total=cart.reduce((s,x)=>s+x.price*x.quantity,0), count=cart.reduce((s,x)=>s+x.quantity,0);
 $("#cart-count").textContent=`${count} item${count===1?"":"s"}`;$("#subtotal").textContent=money(total);$("#total").textContent=money(total);$("#checkout").disabled=!cart.length;
}
function setQty(id,v){const x=cart.find(x=>x.id===id);if(!x)return;const n=Number(v);if(!Number.isInteger(n)||n<1||n>x.sellable){toast("Quantity must be within eligible stock.");drawCart();return}x.quantity=n;drawCart()}
function removeItem(id){cart=cart.filter(x=>x.id!==id);drawCart()}
async function checkout(){
 const btn=$("#checkout");btn.disabled=true;btn.textContent="Processing…";
 try{
  const result=await api("/api/checkout",{method:"POST",body:JSON.stringify({role,cashier:role,payment_method:$("#payment").value,items:cart.map(x=>({product_id:x.id,quantity:x.quantity}))})});
  cart=[];await pos();toast(`Sale #${result.sale_id} completed · ${money(result.total)}`);
 }catch(e){toast(e.message);btn.disabled=false;btn.textContent="Complete checkout"}
}
async function inventory(){
 const [ps,bs]=await Promise.all([api("/api/products"),api("/api/batches")]);products=ps;batches=bs;
 const restockForm=canInventory()?`<div class="card" style="margin-bottom:16px"><div class="section-head" style="margin-top:0"><div><h2>Restock existing product</h2><p>Add a new batch to a product already registered. This will not create a duplicate product.</p></div></div>
 <form id="restock-form" class="form-grid">
 <div class="field full"><label>Scan one item to identify the product</label><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="receive-barcode" class="search" placeholder="Scan or type barcode" autocomplete="off" style="flex:1;min-width:180px"><button type="button" class="btn secondary" id="camera-scan">▥ Scan with camera</button><button type="button" class="btn secondary" id="find-barcode">Find product</button></div><small class="hint">The barcode identifies the product; batch expiry and quantity are entered below.</small></div><div class="field full"><label>Identified product *</label><select name="product_key" id="restock-product" required><option value="">Scan or choose a product…</option>${ps.map(p=>`<option value="${esc(p.barcode)}">${esc(p.name)} · ${esc(p.barcode)}${p.sku?` · ${esc(p.sku)}`:""}</option>`).join("")}</select></div>
 <div class="field"><label>Quantity to add *</label><input name="quantity" type="number" min="1" step="1" required placeholder="e.g. 24"></div>
 <div class="field"><label>New batch expiry *</label><input name="expiry" type="date" required></div>
 <div class="field"><label>Batch code (optional)</label><input name="batch_code" placeholder="Supplier batch code"><small class="hint">Different expiry dates or supplier batches should be saved separately.</small></div>
 <div class="field"><label>Updated unit cost ₹ (optional)</label><input name="cost" type="number" min="0" step=".01" placeholder="Leave blank to keep current"></div>
 <div class="field full"><button class="btn">+ Add stock</button></div></form></div>`:"";
 const addForm=canInventory()?`<div class="card" style="margin-bottom:16px"><div class="section-head" style="margin-top:0"><div><h2>Register product / opening batch</h2><p>Inventory staff can add a barcode and starting stock.</p></div></div>
 <form id="add-product" class="form-grid">
 <div class="field"><label>Barcode *</label><input name="barcode" required placeholder="Unique barcode"></div><div class="field"><label>SKU</label><input name="sku" placeholder="Internal SKU"></div>
 <div class="field full"><label>Product name *</label><input name="name" required placeholder="Product name"></div>
 <div class="field"><label>Category</label><input name="category" value="Grocery"></div><div class="field"><label>Selling price (₹) *</label><input name="price" type="number" min="0" step=".01" required></div>
 <div class="field"><label>Cost (₹, demo only)</label><input name="cost" type="number" min="0" step=".01" value="0"></div><div class="field"><label>Minimum price (₹)</label><input name="min_price" type="number" min="0" step=".01" value="0"></div>
 <div class="field"><label>Opening quantity</label><input name="quantity" type="number" min="0" value="0"></div><div class="field"><label>Batch expiry *</label><input name="expiry" type="date" required></div>
 <div class="field"><label>Batch code</label><input name="batch_code" value="OPENING"></div><div class="field"><label>Reorder point</label><input name="reorder_point" type="number" min="0" value="5"></div>
 <div class="field full"><button class="btn">Save product and batch</button></div></form></div>`:"";
 $("#content").innerHTML=`${restockForm}${addForm}<div class="section-head"><div><h2>Product inventory</h2><p>Sellable quantity excludes expired and quarantined stock.</p></div><button class="btn secondary" onclick="render()">Refresh</button></div><div class="toolbar"><input id="inv-search" class="search" placeholder="Search name, barcode or SKU…"></div><div id="inv-table"></div><div class="section-head"><div><h2>Batch and expiry register</h2><p>Batch status controls whether units can be sold.</p></div></div><div class="table-wrap"><table><thead><tr><th>Batch</th><th>Product</th><th>Expiry</th><th>Quantity</th><th>Status</th>${canInventory()?"<th>Actions</th>":""}</tr></thead><tbody>${bs.map(b=>`<tr><td>${esc(b.batch_code||"—")}</td><td>${esc(b.name)}</td><td>${esc(b.expiry)}</td><td>${b.quantity}</td><td><span class="pill ${b.status==="sellable"?"good":"high"}">${esc(b.status)}</span></td>${canInventory()?`<td><button class="btn secondary edit-expiry" data-batch-id="${b.id}" data-expiry="${esc(b.expiry)}" data-batch="${esc(b.batch_code||"")}" data-product="${esc(b.name)}">Edit expiry</button></td>`:""}</tr>`).join("")}</tbody></table></div>`;
 if(canInventory()) document.querySelectorAll(".edit-expiry").forEach(button=>button.onclick=async()=>{
  const current=button.dataset.expiry||"";
  const label=`${button.dataset.product} · ${button.dataset.batch||"Batch"}`;
  const next=prompt(`Correct expiry date for ${label} (YYYY-MM-DD). Stock quantity will not change:`,current);
  if(next===null)return;
  const expiry=next.trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(expiry)){toast("Enter expiry as YYYY-MM-DD.");return}
  try{const result=await api("/api/batch-expiry",{method:"POST",body:JSON.stringify({role,actor:role,batch_id:Number(button.dataset.batchId),expiry})});toast(result.message||"Expiry updated");await inventory()}
  catch(err){toast(err.message)}
 });
 drawInventoryTable(ps);
 $("#inv-search").addEventListener("input",()=>drawInventoryTable(ps));
 const restock=$("#restock-form");
 if(restock){
  const barcodeInput=$("#receive-barcode"), productSelect=$("#restock-product");
  const matchBarcode=()=>{const code=barcodeInput.value.trim();if(!code)return;const opt=[...productSelect.options].find(o=>o.value===code);if(opt){productSelect.value=code;toast("Product identified: "+opt.textContent)}else{toast("Barcode not registered yet. Register this product first.")}};
  $("#find-barcode").onclick=matchBarcode;
  barcodeInput.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();matchBarcode()}});
  $("#camera-scan").onclick=async()=>{
   if(!("BarcodeDetector" in window)){toast("Camera barcode scanning is not supported by this browser. Use Chrome on Android or a barcode scanner.");return}
   let stream;
   try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});
    const modal=document.createElement("div");modal.className="scan-modal";modal.innerHTML='<div class="scan-modal-card"><h2>Scan product barcode</h2><video autoplay playsinline style="width:100%;border-radius:14px;background:#111"></video><p class="hint">Hold the barcode inside the camera view.</p><button type="button" class="btn secondary">Cancel scan</button></div>';
    Object.assign(modal.style,{position:"fixed",inset:"0",zIndex:"9999",background:"rgba(0,0,0,.65)",display:"grid",placeItems:"center",padding:"20px"});
    Object.assign(modal.firstElementChild.style,{background:"var(--card,#fff)",color:"var(--ink,#17191c)",padding:"22px",borderRadius:"24px",width:"min(460px,100%)"});document.body.appendChild(modal);
    const video=modal.querySelector("video");video.srcObject=stream;await video.play();const detector=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128","code_39","qr_code"]});let active=true;
    const close=()=>{active=false;stream.getTracks().forEach(t=>t.stop());modal.remove()};modal.querySelector("button").onclick=close;
    const scan=async()=>{if(!active)return;try{const codes=await detector.detect(video);if(codes.length){barcodeInput.value=codes[0].rawValue;close();matchBarcode();return}}catch(_){}requestAnimationFrame(scan)};scan();
   }catch(err){if(stream)stream.getTracks().forEach(t=>t.stop());toast("Camera access failed. Allow camera permission or enter the barcode manually.")}
  };
 }
 if(restock)restock.onsubmit=async e=>{
  e.preventDefault();const d=Object.fromEntries(new FormData(restock));
  const payload={role,actor:role,barcode:d.product_key,quantity:Number(d.quantity),expiry:d.expiry};
  if(d.batch_code.trim())payload.batch_code=d.batch_code.trim();
  if(d.cost.trim()!=="")payload.cost=Number(d.cost);
  const button=restock.querySelector('button[type="submit"],button:not([type])');if(button){button.disabled=true;button.textContent="Adding stock…"}
  try{const result=await api("/api/restock",{method:"POST",body:JSON.stringify(payload)});toast(result.message||"Stock added successfully");await inventory()}
  catch(err){toast(err.message);if(button){button.disabled=false;button.textContent="+ Add stock"}}
 };
 const form=$("#add-product");if(form)form.onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(form));d.role=role;d.price=Number(d.price);d.cost=Number(d.cost||0);d.min_price=Number(d.min_price||0);d.quantity=Number(d.quantity||0);d.reorder_point=Number(d.reorder_point||5);try{await api("/api/products",{method:"POST",body:JSON.stringify(d)});toast("Product registered");await inventory()}catch(err){toast(err.message)}};
}
function drawInventoryTable(ps){
 const q=($("#inv-search")?.value||"").toLowerCase(), matches=ps.filter(p=>p.name.toLowerCase().includes(q)||p.barcode.includes(q)||String(p.sku||"").toLowerCase().includes(q));
 $("#inv-table").innerHTML=`<div class="table-wrap"><table><thead><tr><th>Product</th><th>Barcode</th><th>Category</th><th>Sellable stock</th><th>Reorder point</th><th>Price</th></tr></thead><tbody>${matches.map(p=>`<tr><td><strong>${esc(p.name)}</strong></td><td>${esc(p.barcode)}</td><td>${esc(p.category)}</td><td><span class="pill ${Number(p.sellable??p.stock??p.quantity??0)<=Number(p.reorder_point)?"high":"good"}">${Number(p.sellable??p.stock??p.quantity??0)}</span></td><td>${p.reorder_point}</td><td>${money(p.price)}</td></tr>`).join("")||'<tr><td colspan="6">No products found.</td></tr>'}</tbody></table></div>`;
}
async function agents(){
 const a=await api("/api/agents");
 const meta={"Demand Forecast":["◷","tint-lav"],"Expiry Prevention":["♧","tint-butter"],"Inventory Optimization":["▦","tint-mint"],"Store Transfer":["⇄","tint-lime"],"Decision Coordinator":["✳","tint-blush"],"Profit Optimization":["₹","tint-butter"]};
 $("#content").innerHTML=`<div class="card tint-mint" style="margin-bottom:17px"><div class="section-head" style="margin-top:0"><div><h2>Six specialist agents. One inventory truth.</h2><p class="subtitle">Rule-based recommendations use current stock, expiry dates, margins, and optional simulated sales history.</p></div><button class="btn" id="load-demo-data">Load Demo Data</button></div><p class="hint">Adds clearly labelled sample sales for demand analysis. It does not delete existing records or change current stock quantities. Demo sales will appear in sales totals.</p></div><div class="grid two-col">${a.map(x=>{const m=meta[x.agent]||["✳",""];return `<div class="card"><div class="agent-card"><div class="agent-mark ${m[1]}">${m[0]}</div><div class="agent-content" style="flex:1"><div class="section-head" style="margin:0 0 7px"><h3>${esc(x.agent)}</h3><span class="pill ${x.priority.toLowerCase()}">${esc(x.priority)}</span></div><strong>${esc(x.product)}</strong><p class="subtitle">${esc(x.finding)}</p><div class="muted" style="margin-top:9px">Recommended decision</div><p style="font-size:13px;margin:4px 0 0">${esc(x.action)}</p>${x.type==="expiry"&&x.discount_available?`<div style="margin-top:12px;padding:12px;border:1px solid var(--line,#e6e2dc);border-radius:14px;background:var(--surface,#faf9f6)"><div style="font-weight:700;font-size:16px">Suggested discount: ${x.discount_percent}%</div><div style="display:flex;justify-content:space-between;gap:8px;margin-top:8px"><span class="muted">Original price</span><span>${money(x.original_price)}</span></div><div style="display:flex;justify-content:space-between;gap:8px;margin-top:5px"><span class="muted">Suggested price</span><strong>${money(x.suggested_price)}</strong></div><div style="display:flex;justify-content:space-between;gap:8px;margin-top:5px"><span class="muted">Unit cost / margin floor</span><span>${money(x.unit_cost)}</span></div>${(role==="Manager"||role==="Owner/Admin")?`<div style="display:flex;gap:8px;margin-top:12px"><button class="btn approve-discount" data-id="${x.product_id}" data-original="${x.original_price}" data-price="${x.suggested_price}" data-pct="${x.discount_percent}" style="flex:1">Approve discount</button><button class="btn secondary reject-discount" data-id="${x.product_id}" data-original="${x.original_price}" data-price="${x.suggested_price}" data-pct="${x.discount_percent}" style="flex:1">Reject</button></div>`:`<p class="hint">Manager approval required to apply this discount.</p>`}</div>`:""}</div></div></div>`}).join("")}</div>`;
 const demoBtn=$("#load-demo-data"); if(demoBtn) demoBtn.onclick=async()=>{demoBtn.disabled=true;demoBtn.textContent="Loading…";try{const r=await api("/api/demo-data",{method:"POST",body:JSON.stringify({role})});toast(r.message||"Demo data loaded");await agents()}catch(e){toast(e.message);demoBtn.disabled=false;demoBtn.textContent="Load Demo Data"}};
 document.querySelectorAll(".approve-discount,.reject-discount").forEach(btn=>btn.onclick=async()=>{const decision=btn.classList.contains("approve-discount")?"approve":"reject";if(decision==="approve"&&!confirm("Apply this discounted price to POS? The current product price will change."))return;btn.disabled=true;try{const r=await api("/api/discount-decision",{method:"POST",body:JSON.stringify({role,decision,product_id:Number(btn.dataset.id),original_price:Number(btn.dataset.original),suggested_price:Number(btn.dataset.price),discount_percent:Number(btn.dataset.pct)})});toast(r.message);await agents()}catch(e){toast(e.message);btn.disabled=false}});
}
async function purchases(){
 const [ps, history]=await Promise.all([api("/api/products"),api("/api/purchases")]);
 const form=canInventory()?`<div class="card" style="margin-bottom:16px"><div class="section-head" style="margin-top:0"><div><h2>Record vendor purchase</h2><p>Enter invoice details and received stock. Every purchase creates a traceable batch.</p></div></div>
 <form id="purchase-form" class="form-grid">
 <div class="field"><label>Vendor / supplier name *</label><input name="vendor_name" required placeholder="e.g. Fresh Dairy Supplies"></div>
 <div class="field"><label>Invoice number *</label><input name="invoice_number" required placeholder="e.g. INV-1042"></div>
 <div class="field full"><label>Product *</label><select name="barcode" required><option value="">Choose registered product…</option>${ps.map(p=>`<option value="${esc(p.barcode)}">${esc(p.name)} · ${esc(p.barcode)}</option>`).join("")}</select><small class="hint">Register a new product first in Inventory; don't re-register products for each delivery.</small></div>
 <div class="field"><label>Quantity received *</label><input name="quantity" type="number" min="1" step="1" required placeholder="e.g. 50"></div>
 <div class="field"><label>Purchase cost per unit (₹) *</label><input name="unit_cost" type="number" min="0" step=".01" required placeholder="e.g. 20"></div>
 <div class="field"><label>Batch expiry *</label><input name="expiry" type="date" required></div>
 <div class="field"><label>Vendor batch code (optional)</label><input name="batch_code" placeholder="Supplier batch code"></div>
 <div class="field full"><button class="btn" type="submit">+ Record purchase & add stock</button></div></form>
 <p class="hint">Recorded by: <strong>${esc(role)}</strong>. This prototype records the selected demo role, not a verified personal account.</p></div>`:"";
 const total=history.reduce((sum,p)=>sum+Number(p.total_cost||0),0);
 $("#content").innerHTML=`${form}<div class="grid three-col" style="margin-bottom:16px"><div class="card"><div class="metric-label">Purchase records</div><div class="metric-value">${history.length}</div><div class="metric-note">Latest 200 invoice lines</div></div><div class="card tint-butter"><div class="metric-label">Recorded purchase value</div><div class="metric-value">${money(total)}</div><div class="metric-note">Across displayed records</div></div><div class="card tint-mint"><div class="metric-label">Traceability</div><div class="metric-value">Invoice → Batch</div><div class="metric-note">Vendor, expiry, cost and recorder</div></div></div>
 <div class="card"><div class="section-head" style="margin-top:0"><div><h2>Purchase history</h2><p>Each row links a vendor invoice to the received batch.</p></div><button class="btn secondary" onclick="render()">Refresh</button></div>
 ${history.length?`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Invoice</th><th>Vendor</th><th>Product / batch</th><th>Expiry</th><th>Qty</th><th>Unit cost</th><th>Total cost</th><th>Recorded by</th></tr></thead><tbody>${history.map(x=>`<tr><td>${esc(x.purchased_at)}</td><td>${esc(x.invoice_number)}</td><td>${esc(x.vendor_name)}</td><td><strong>${esc(x.product_name)}</strong><div class="muted">${esc(x.batch_code||"")}</div></td><td>${esc(x.expiry)}</td><td>${x.quantity}</td><td>${money(x.unit_cost)}</td><td><strong>${money(x.total_cost)}</strong></td><td>${esc(x.recorded_by)}</td></tr>`).join("")}</tbody></table></div>`:'<div class="empty">No vendor purchases recorded yet. Use the form above to record your first invoice.</div>'}</div>`;
 const pf=$("#purchase-form"); if(pf)pf.onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(pf));const btn=pf.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent="Recording purchase…";try{const result=await api("/api/purchases",{method:"POST",body:JSON.stringify({...d,role,actor:role,quantity:Number(d.quantity),unit_cost:Number(d.unit_cost)})});toast(`${result.message} · Total ${money(result.purchase_cost)}`);await purchases()}catch(err){toast(err.message);btn.disabled=false;btn.textContent="+ Record purchase & add stock"}};
}
async function sales(){
 const s=await api("/api/sales");
 $("#content").innerHTML=`<div class="card"><div class="section-head" style="margin-top:0"><div><h2>Recent transactions</h2><p>Completed sales from this local database.</p></div><button class="btn secondary" onclick="go('pos')">New sale</button></div>${s.length?`<div class="table-wrap"><table><thead><tr><th>Sale ID</th><th>Timestamp</th><th>Cashier</th><th>Payment</th><th>Total</th></tr></thead><tbody>${s.map(x=>`<tr><td>#${x.id}</td><td>${esc(x.created_at)}</td><td>${esc(x.cashier)}</td><td>${esc(x.payment_method)}</td><td><strong>${money(x.total)}</strong></td></tr>`).join("")}</tbody></table></div>`:'<div class="empty">No sales recorded yet. Complete a test checkout in POS to see a transaction here.</div>'}</div>`;
}
document.querySelectorAll(".nav").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));
$("#role").addEventListener("change",setRole);
// The landing page is the entry point; initialize the workspace after sign-in.
role = "Manager";
$("#role").value = role;
function openSignIn(){ $("#landing").classList.add("hidden"); $("#signin-screen").classList.remove("hidden"); window.scrollTo({top:0,behavior:"smooth"}); }
function backToLanding(){ $("#signin-screen").classList.add("hidden"); $("#landing").classList.remove("hidden"); window.scrollTo({top:0,behavior:"smooth"}); }
document.querySelectorAll("[data-open-login]").forEach(button=>button.addEventListener("click",openSignIn));
$("#back-to-landing").addEventListener("click",backToLanding);
$("#signin-form").addEventListener("submit",event=>{event.preventDefault();role=$("#signin-role").value;$("#role").value=role;$("#signin-screen").classList.add("hidden");$("#app-screen");document.querySelector(".app").classList.remove("hidden");setRole();window.scrollTo({top:0,behavior:"smooth"});});

// Sign-in prototype controls. Authentication is intentionally demo-only until a real identity provider/backend is configured.
let authMode="login";
const loginTab=document.querySelector("#login-tab"), signupTab=document.querySelector("#signup-tab");
function setAuthMode(mode){authMode=mode;loginTab?.classList.toggle("active",mode==="login");signupTab?.classList.toggle("active",mode==="signup");const title=document.querySelector("#signin-screen h1");if(title)title.innerHTML=(mode==="login"?"Sign in to<br><span>ZeroWaste AI.</span>":"Create your<br><span>store account.</span>");const b=document.querySelector(".signin-submit");if(b)b.innerHTML=(mode==="login"?"Continue to workspace <span>↗</span>":"Create demo account <span>↗</span>");}
loginTab?.addEventListener("click",()=>setAuthMode("login"));signupTab?.addEventListener("click",()=>setAuthMode("signup"));
document.querySelector("#signin-role")?.addEventListener("change",e=>{const employee=["Inventory Employee","Cashier"].includes(e.target.value);document.querySelector("#employee-credentials")?.classList.toggle("hidden",!employee);document.querySelector("#manager-credentials")?.classList.toggle("hidden",employee);});
document.querySelector("#google-login")?.addEventListener("click",()=>toast("Google sign-in needs Firebase Authentication setup; demo login is available for preview."));
