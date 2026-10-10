# ZeroWaste AI — Runnable Starter

A local, no-extra-packages Python + SQLite demo for the ZeroWaste AI grocery inventory and waste-prevention concept.

## Requirements
- Python 3.10+ (Python 3.12 recommended)
- A modern browser
- Internet is not required to run the app

## Start on Windows
1. Extract the ZIP file.
2. Open the extracted `ZeroWasteAI` folder in VS Code.
3. Open **Terminal → New Terminal**.
4. Run:

   ```powershell
   py app.py
   ```

   If `py` is not available, try `python app.py`.

5. Open http://localhost:8000 in your browser.
6. Press `Ctrl+C` in the terminal to stop the server.

The app creates `zerowaste.db` automatically on first run. To reset the demo data, stop the server and delete `zerowaste.db`; it will be recreated next launch.

## Barcode billing
- A USB or Bluetooth scanner that types the scanned digits as keyboard input should work.
- Click the barcode input and scan. Most scanners send Enter after the barcode; this app uses Enter to look up and add the product.
- You can test without hardware using the demo barcodes shown in Inventory or:
  - Milk: `8901030895014`
  - Bread: `8901725133010`
  - Rice: `8901234567890`
  - Yogurt: `8901058001234`
  - Banana: `8906010500012`
  - Biscuits: `8904004400019`
- Unknown barcodes are rejected. Camera scanning is not implemented in this starter.

## Demo roles
Use the role selector in the sidebar to explore:
- **Manager** — overview, AI signals, inventory, POS, sales
- **Inventory Employee** — inventory data entry and stock list
- **Cashier** — POS billing only
- **Owner/Admin** — starter inventory access; user administration is not implemented yet

**Important prototype limitation:** the role selector is a local demonstration control, not production authentication. Do not deploy this starter publicly or use it for real payments or real store operations. Production needs secure login, server-verified identities and roles, organization/store isolation, CSRF/session protection, stronger audit controls, payment integration, tax configuration, and automated tests.

## Included
- Persistent local SQLite data
- Product/barcode lookup
- Barcode-first cart flow
- FEFO batch allocation during checkout
- Expired and quarantined stock excluded from sale
- Transactional checkout and stock movements
- Product registration and batch expiry
- Overview, five transparent rule-based agent signals, sales history
- Restock existing products by creating a new expiry-tracked batch (does not duplicate product records)
- Lattice-inspired parchment/forest/pastel styling

## Not yet implemented
This is an executable starter, not the entire master specification. Camera barcode scanning, real authentication, multi-store transfer execution, supplier purchase orders, refunds, taxes, external AI integrations, management approvals, advanced forecasting, measured impact evaluation, and production security still need implementation. The five items on the AI Team page are currently rule-based specialist modules, not autonomous LLM agents. No API key is required for this offline demo.


## Barcode receiving + batches
- Inventory staff can use **Scan with camera** in the receiving form on supported browsers (HTTPS or localhost and camera permission required). Chrome on Android is recommended. USB/Bluetooth scanners that type into the barcode field also work.
- Scan one unit to identify the registered product, then enter the received quantity, expiry date and optional supplier batch code. Save separate batches for different expiry dates/batch lots. A normal barcode does not contain expiry or received quantity.
- If a barcode is not registered, register the product first. This prototype uses the store's own barcode catalogue; an external product database is not configured.
- Checkout uses earliest-expiry-first (FEFO) allocation across eligible sellable batches.

## Authentication status
The login/signup tabs and role-specific fields are prototype UI only. Google OAuth, persistent employee accounts, password hashing, store membership and server-side sessions have **not** been configured. Do not use real credentials or expose this demo publicly. Before production, connect Firebase Authentication (including Google provider) or another identity provider and enforce roles server-side.


## Purchases & Vendors
Use the Purchases & Vendors page to record supplier name, invoice number, registered product barcode, received quantity, unit purchase cost, batch expiry, and optional vendor batch code. A purchase creates a new stock batch and movement record. The page shows purchase history and who recorded each entry. Demo role labels are not secure user authentication.

## Multi-agent AI
The AI Team page combines rule-based specialist signals for expiry prevention, inventory optimization, demand forecasting guidance, store-transfer readiness, profit optimization, and decision coordination. These are transparent rule-based demo agents, not a trained forecasting model or external LLM integration.


## Demo dataset included

This ZIP includes clearly labelled simulated sales, six demo vendor purchase records, four demo suppliers, additional batch inventory with expiry dates, and stock movement records for opening stock and vendor receipts. Demo purchases are labelled DEMO DATA and are not real transactions. Running the app does not need an external service.
