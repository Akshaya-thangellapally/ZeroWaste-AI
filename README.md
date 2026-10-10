# ZeroWaste AI — Smarter Stock. Less Waste. Better Profits.

ZeroWaste AI is a grocery inventory management and food-waste prevention project built using Python, SQLite, HTML, CSS, and JavaScript.

It helps grocery stores manage stock, track expiry dates, reduce food waste, recommend discounts, process barcode-based billing, and monitor sales and profits.

The project uses transparent, rule-based decision-support modules to provide useful inventory insights. It is a runnable local prototype designed for demonstration and learning.

## Features

### 1. Inventory Management
- Add and register products using their barcodes.
- View and manage available stock.
- Track batch quantities and expiry dates.
- Restock existing products without creating duplicate product records.
- Exclude expired and quarantined stock from sales.

### 2. Barcode-Based Billing
- Search for products using barcode numbers.
- Add scanned products to the billing cart.
- Support USB and Bluetooth barcode scanners that work as keyboard input.
- Calculate bills and update stock after checkout.
- Allocate stock using FEFO (First Expiry, First Out).

### 3. Expiry and Waste Prevention
- Track product expiry dates by batch.
- Identify products that are expired or approaching expiry.
- Provide rule-based signals to help prevent food waste.
- Suggest actions such as prioritizing stock or considering discounts where appropriate.

### 4. Sales and Profit Dashboard
- View sales history and transaction records.
- Monitor inventory and sales information.
- Review purchase costs and selling prices where supported by the application.
- Use available dashboard insights to support store decisions.

### 5. Purchases and Vendors
- Record supplier and invoice information.
- Record received quantities, purchase costs, expiry dates, and optional vendor batch codes.
- Create new stock batches when products are received.
- Maintain purchase and stock-movement records.

### 6. Rule-Based AI Decision Support
The AI Team page contains specialist modules for:
- Expiry and waste prevention
- Inventory optimization
- Demand forecasting guidance
- Store-transfer readiness
- Profit optimization
- Decision coordination

These modules use predefined rules and available inventory or sales data to generate signals and recommendations. They are not trained machine-learning models or autonomous LLM agents.

## Technology Stack

- **Python** — Backend logic and application server
- **SQLite** — Local database for products, batches, sales, and other supported records
- **HTML** — Page structure
- **CSS** — User interface and styling
- **JavaScript** — Frontend interactions
- **Python HTTP Server** — Serves the local application without requiring additional Python packages

## Requirements

- Python 3.10 or newer
- A modern web browser
- Visual Studio Code (recommended)
- No additional Python packages required for the starter version
- No internet connection required to run the local application

Some browser features, such as camera scanning, require camera permission and a supported browser. Camera access generally works on localhost or HTTPS.

## How to Run the Project on Windows

1. Download and extract the project ZIP file.
2. Open the extracted `ZeroWasteAI` folder in Visual Studio Code.
3. Open **Terminal → New Terminal**.
4. Run the following command:

   ```powershell
   py app.py
   ```

5. If the `py` command is unavailable, try:

   ```powershell
   python app.py
   ```

6. Open the following address in your browser:

   http://localhost:8000

7. Keep the terminal running while using the application.
8. Press `Ctrl + C` in the terminal to stop the server.

The application creates `zerowaste.db` automatically on its first run, if configured to do so.

**Resetting demo data:** Stop the server and delete `zerowaste.db` to recreate the database on the next launch. This permanently removes the existing local database, so back it up first if needed.

## Barcode Scanning

The application supports barcode input from compatible USB or Bluetooth scanners that type digits like a keyboard.

1. Open the relevant inventory or billing screen.
2. Click the barcode input field.
3. Scan the product barcode.
4. If the scanner sends Enter automatically, the application can use it to look up the product.

Demo barcodes:

| Product | Barcode |
|---|---|
| Milk | `8901030895014` |
| Bread | `8901725133010` |
| Rice | `8901234567890` |
| Yogurt | `8901058001234` |
| Banana | `8906010500012` |
| Biscuits | `8904004400019` |

Unknown barcodes are rejected unless the product is registered first.

Camera scanning is available only if it is implemented in the version being used. A normal product barcode does not contain the product's expiry date or the quantity received.

## Inventory Batches and FEFO

A product can have multiple batches with different expiry dates.

When receiving stock, record the product, quantity, expiry date, and any optional supplier batch code. Each batch can then be tracked separately.

FEFO stands for **First Expiry, First Out**. It means that eligible stock with the earliest expiry date is allocated for sale first.

The checkout process should exclude expired or quarantined batches and update stock records transactionally.

## Demo Roles

The role selector may provide the following demonstration views, depending on the version:

- **Manager** — Overview, inventory insights, inventory, POS, and sales
- **Inventory Employee** — Inventory entry and stock list
- **Cashier** — POS billing
- **Owner/Admin** — Starter inventory access

These are prototype roles, not secure authentication. Changing a role in the interface does not establish a verified identity.

## Demo Data

The project may include simulated:
- Products and inventory batches
- Sales and transactions
- Supplier and vendor purchase records
- Stock movements and expiry dates

Demo records are for testing and presentation only. They do not represent real store transactions.

## Project Structure

The exact file structure depends on the version of the project. A typical layout may look like this:


ZeroWasteAI/
├── app.py
├── zerowaste.db
├── README.md
├── .gitignore
├── static/
│   ├── style.css
│   └── script.js
└── templates/
    └── index.html


The database may be generated automatically when the application starts. Adjust this structure to match the actual files in your project.

## Design

The interface follows a minimalist **Steep-inspired design** with:
- White and soft neutral backgrounds
- Dark text and subtle peach accents
- Clean typography and generous spacing
- Rounded cards, inputs, and buttons
- Simple dashboards focused on readability

Update this description if the actual interface uses a different design.

## Security and Prototype Limitations

This project is a local demonstration prototype. It is not ready for public deployment or real store operations.

Depending on the version, the following may not be implemented:
- Secure login and signup
- Google OAuth or another identity provider
- Password hashing and server-side sessions
- Server-side role and store-access verification
- CSRF protection and stronger audit controls
- Multi-store transfer execution
- Supplier purchase-order workflows
- Refunds, tax configuration, and payment integration
- External AI integrations and trained forecasting models
- Automated tests and production monitoring

Do not use real passwords, payment details, or sensitive customer information in the demo. Do not expose the local prototype publicly without implementing appropriate security controls.

## Future Improvements

Planned improvements may include:
- Secure authentication and role-based access control
- Camera barcode scanning across supported devices
- More advanced demand forecasting
- Improved expiry-based discount recommendations
- Multi-store stock transfers
- Supplier purchase-order management
- Refund and tax support
- External AI integrations where appropriate
- Automated testing and measured food-waste reduction

These are future enhancements, not claims that the features are already implemented.

## Project Summary

ZeroWaste AI demonstrates how inventory tracking, expiry-aware stock allocation, barcode-based billing, sales records, and transparent rule-based recommendations can work together to help grocery stores manage inventory and reduce avoidable food waste.

**ZeroWaste AI — Smarter Stock. Less Waste. Better Profits.**
