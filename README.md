# LocoStock: Premium Retail-Tech Platform
**Product tagline:** *Local Products. Real Shops.*

LocoStock connects shoppers searching for products with nearby local brick-and-mortar stores that stock them. Live stock availability is synchronized directly through shopkeeper point-of-sale invoice entries.

---

## 1. Premium Dark Mode Design System

LocoStock features a cohesive retail-tech design system built around the following tokens:

- **Primary background:** `#101512`
- **Secondary background:** `#151C18`
- **Card background:** `#1B241F`
- **Elevated surface:** `#232E27`
- **Primary emerald:** `#22C55E`
- **Bright emerald:** `#34D399`
- **Soft mint:** `#B7F7CE`
- **Primary text:** `#F5F7F5`
- **Secondary text:** `#A1ADA5`
- **Subtle borders:** `#303D34`
- **Status Indicators:**
  - *In-Stock / Success:* `#34D399` on `#132B1C` border `#245836`
  - *Low Stock / Warning:* `#F59E0B` on `#2D2210` border `#5C4318`
  - *Out of Stock / Critical:* `#EF4444` on `#2D1515` border `#5C2424`
- **Map Theming:** High-contrast CartoDB Dark Matter tiles with glowing emerald marker pins and dark popup cards.

---

## 2. Application Architecture & Routes

### A. LocoStock Customer Discovery App
- **Landing Page ([`/`](file:///C:/Users/Pavan/Downloads/LOCOSTOCK/src/app/page.tsx))**:
  - Prominent search bar as visual focal point.
  - Manual location picker and GPS compass button.
  - Quick category shortcuts (Electronics, Stationery, Groceries, Hardware).
  - Recent searches with 1-tap repeat search and clear history controls.
  - Live available products section loaded from real database records.
- **Product Discovery & Comparison ([`/search`](file:///C:/Users/Pavan/Downloads/LOCOSTOCK/src/app/search/page.tsx))**:
  - Multi-shop search by name, brand, model, SKU, or category.
  - Distance radius control (2 km to 50 km) calculated via Haversine formula.
  - Price filter range and in-stock only toggle.
  - Dual view modes: Dark Map view with interactive shop pins, and responsive product cards with freshness timestamps and Google Maps turn-by-turn directions.
- **Shops Directory ([`/shops`](file:///C:/Users/Pavan/Downloads/LOCOSTOCK/src/app/shops/page.tsx))**:
  - Browse verified local shops by locality, category, and radius.
- **Public Shop Profile & Catalogue ([`/shops/[id]`](file:///C:/Users/Pavan/Downloads/LOCOSTOCK/src/app/shops/%5Bid%5D/page.tsx))**:
  - Verified merchant badge, store hours, contact phone, street address, and embedded coordinates map.
  - Real-time shop catalogue search with category filtering and stock levels.
- **Search History Screen ([`/history`](file:///C:/Users/Pavan/Downloads/LOCOSTOCK/src/app/history/page.tsx))**:
  - Dedicated search history page preserving up to 10 queries in localStorage.

### B. LocoStock Shopkeeper Portal
- **Dashboard ([`/shopkeeper`](file:///C:/Users/Pavan/Downloads/LOCOSTOCK/src/app/shopkeeper/page.tsx))**:
  - Operational metrics derived from live DB records: total products, low-stock alerts, out-of-stock items, total revenue, and bill counts.
  - Recent finalized invoice feed and inventory alerts.
- **Welcome & OTP Authentication ([`/shopkeeper/login`](file:///C:/Users/Pavan/Downloads/LOCOSTOCK/src/app/shopkeeper/login/page.tsx))**:
  - Professional merchant login with email OTP verification.
  - Supports live Supabase Auth and an explicit prototype mode (code `123456`).
- **5-Step Shop Registration ([`/shopkeeper/onboarding`](file:///C:/Users/Pavan/Downloads/LOCOSTOCK/src/app/shopkeeper/onboarding/page.tsx))**:
  - Step 1: Shopkeeper Details
  - Step 2: Shop Information
  - Step 3: Physical Address
  - Step 4: Map Location Pinning (interactive dark map + GPS placement)
  - Step 5: Review & Submit
- **Fast Billing Point-of-Sale ([`/shopkeeper/billing`](file:///C:/Users/Pavan/Downloads/LOCOSTOCK/src/app/shopkeeper/billing/page.tsx))**:
  - High-speed POS interface: search products by name or SKU/barcode.
  - Quantity controls, tax GST % and discount inputs, line totals.
  - Atomic stock deductions and printable invoice receipts.
  - Idempotency key protection preventing duplicate submissions.
- **Product & Inventory Manager ([`/shopkeeper/inventory`](file:///C:/Users/Pavan/Downloads/LOCOSTOCK/src/app/shopkeeper/inventory/page.tsx))**:
  - Add and edit product listings with prices, SKUs, and stock quantities.
- **Sales & Stock Movement Audit Log ([`/shopkeeper/history`](file:///C:/Users/Pavan/Downloads/LOCOSTOCK/src/app/shopkeeper/history/page.tsx))**:
  - Full audit trail of stock-ins, sales deductions, returns, and adjustments.
  - Invoice archive with printable tax invoice layouts.
- **Store Profile & Map Location ([`/shopkeeper/shop`](file:///C:/Users/Pavan/Downloads/LOCOSTOCK/src/app/shopkeeper/shop/page.tsx))**:
  - Store identity, operating schedule, and interactive map marker repositioning.

---

## 3. Quick Start & Execution

```bash
# Start Development Server
npm run dev
```

- **Customer Discovery App**: [http://localhost:3000](http://localhost:3000)
- **Shopkeeper Portal**: [http://localhost:3000/shopkeeper](http://localhost:3000/shopkeeper)
- **Shopkeeper Authentication**: [http://localhost:3000/shopkeeper/login](http://localhost:3000/shopkeeper/login)
- **Search History**: [http://localhost:3000/history](http://localhost:3000/history)

```bash
# Run Unit Verification Tests
node test_locostock.js

# Build Production Bundle
npm run build
npm start
```
