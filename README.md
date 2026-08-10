# Product Selector — Invendis Technologies

A browser-based product catalogue for Invendis Technologies. Customers can browse, filter, search, compare, and download datasheets for the full range of Invendis products (routers, gateways, switches, energy meters, and accessories).

No framework, no build step. Open `index.html` directly in a browser or serve the folder with any static file server.

---

## What it does

- **Browse** all products in grid or list view, paginated 12 per page
- **Filter** by category tab, cellular generation, Wi-Fi standard, port count, and serial interface (RS485/RS232)
- **Search** by name, model, description, or CPU keyword
- **Compare** up to 3 products side-by-side in a spec table (differences highlighted in yellow)
- **Detail modal** — click any product to see its image carousel, typical use cases, full specs, and product variants table, along with product datasheets (if available)
- **Datasheets** — each variant row shows View and Download buttons if a PDF exists; otherwise a pre-filled "Contact us" mailto link is shown
- **Enquire** — mailto button pre-filled with the product name goes directly to `sales@invendis.com`
- **Fully responsive** — works on desktop, tablet, and mobile (modal becomes a bottom sheet on small screens)

---

## Project structure

```
ProductSelector/
├── index.html              — Page markup, filter controls, script loading order
├── styles.css              — All styling (layout, cards, modal, responsive breakpoints)
├── products.js             — Product data (PRODUCTS_DATA array, one object per product)
├── js/
│   ├── config.js           — Global constants (CATS, PAGE_SIZE) and mutable state
│   ├── data.js             — PRODUCT_IMAGES, PRODUCT_USE_CASES, PART_DATASHEETS, PRODUCT_DATASHEETS
│   ├── utils.js            — Pure helpers: catBadgeClass, wifiLabel, srow
│   ├── filters.js          — Filtering logic: getFiltered, hasActiveFilters, setCat, clearFilters
│   ├── render.js           — DOM rendering: grid cards, list rows, pagination, category tabs
│   ├── compare.js          — Compare feature: toggleCompare, tray, openCompareModal
│   ├── modal.js            — Detail modal: openDetail, buildVariantsTable, buildDatasheetsSection, carousel
│   └── main.js             — Bootstrap: seeds PRODUCTS from PRODUCTS_DATA and calls render()
└── assets/
    ├── invendis_logo.png
    ├── silbo_logo.png
    ├── images/             — Product photos (PNG/JPG), one or more per product
    └── datasheets/         — Product datasheets (PDF), one per variant part number
```

Scripts load in the order listed above. Each file depends only on globals declared by earlier files — no bundler needed.

---

## Data files at a glance

All four lookup maps live in **`js/data.js`** and are keyed by the same values used in `products.js`:

| Constant | Key | Value |
|---|---|---|
| `PRODUCT_IMAGES` | product `id` | Array of image paths (enables carousel if > 1) |
| `PRODUCT_USE_CASES` | product `id` | Array of short use-case label strings |
| `PART_DATASHEETS` | exact part-number string from the last column of a variants row | Path to PDF |
| `PRODUCT_DATASHEETS` | product `id` | Path to PDF (for products with no per-variant table) |

---

## How to add a new product

### Step 1 — Add product data to `products.js`

Add a new object to the `PRODUCTS_DATA` array. All fields are required unless marked optional.

```js
{
  id:           'unique-id',       // kebab-case; must be unique; used as key in all data.js maps
  name:         'Display Name',    // shown on cards, modals, and compare table
  cat:          'Router',          // one of: Router | Gateway | Switch | Energy Meter | Other
  desc:         'Short description shown on the card and in the modal',
  cpu:          '...',
  ram:          '...',             // use '—' if not applicable
  storage:      '...',             // use '—' if not applicable
  cell:         '...',             // human-readable label, e.g. '4G' or '4G/5G (dual modem)'
  cellular_gen: '4G',              // '5G' | '4G' | 'none'  — drives the cellular filter
  wifi:         'WiFi5',           // 'WiFi6' | 'WiFi5' | 'WiFi24' | 'none'  — drives the Wi-Fi filter
  rs485:        true,              // boolean — drives the serial filter
  rs232:        false,
  ip:           'IP40',            // housing/IP rating string, or '' if not specified
  power:        '9–30 VDC',
  ports:        4,                 // total Ethernet port count — drives the port filter
  os:           '...',             // use '—' if not applicable
  housing:      'Aluminium',
  dims:         '150×90×30 mm',   // use '—' if unknown
  weight:       '350 g',           // use '—' if unknown
  op_temp:      '-40–70 °C',       // use '—' if unknown
  variants:     null               // set to null if no variants table; see below for the variants schema
}
```

### Step 2 — Add the image to `js/data.js` → `PRODUCT_IMAGES`

```js
'unique-id': ['assets/images/your-product.png'],
// For a carousel (multiple images):
'unique-id': ['assets/images/your-product-1.png', 'assets/images/your-product-2.png'],
```

Place the image file(s) in `assets/images/`.

### Step 3 — Add use cases to `js/data.js` → `PRODUCT_USE_CASES`

```js
'unique-id': ['Use Case One', 'Use Case Two', 'Use Case Three', 'Use Case Four'],
```

The first two are shown as chips on the grid card. All appear inside the detail modal.

### Step 4 — Add datasheets (if applicable)

**Option A — Per-variant datasheets** (product has a variants table):
Add one entry per part number to `PART_DATASHEETS`. The key must exactly match the string in the last column of the variants row (parenthetical notes like `(Rev B)` are stripped automatically).

```js
// In PART_DATASHEETS:
'PART-001': 'assets/datasheets/PART-001.pdf',
'PART-002': 'assets/datasheets/PART-002.pdf',
```

If a part number has no matching entry, a "Contact us" link is shown instead (opens a pre-filled email to `sales@invendis.com`).

**Option B — Product-level datasheet** (product has no variants table, or one family PDF covers all variants):
Add one entry to `PRODUCT_DATASHEETS`:

```js
// In PRODUCT_DATASHEETS:
'unique-id': 'assets/datasheets/Your-Product-Datasheet.pdf',
```

Place the PDF(s) in `assets/datasheets/`.

---

## How to add variants to an existing product

Set the `variants` field in the product object in `products.js`:

```js
variants: {
  note: 'Optional explanatory note shown above the table (use null or omit to hide)',
  headers: ['Column 1', 'Column 2', 'Part No.'],   // last header is always the part number
  rows: [
    ['Value A', 'Value B', 'PART-001'],
    ['Value C', 'Value D', 'PART-002'],
  ]
}
```

Then add each part number to `PART_DATASHEETS` in `js/data.js` (Step 4, Option A above).

**Notes:**
- Use `'✓'` for a yes/supported cell — it renders as a green checkmark.
- Use `'—'` for a no/not-applicable cell — it renders as a grey dash.
- The **Data Sheet column is added automatically** only when at least one part number in the table has a matching entry in `PART_DATASHEETS`. You do not need to add it to the `headers` array.
- Part numbers can include parenthetical suffixes like `'RD44-C (Rev 2)'` — the lookup strips the suffix automatically.

---

## How to modify an existing product

1. Find the product object in `products.js` by its `id` and edit any field directly.
2. If you change the `id`, you **must** also update the matching keys in all four maps in `js/data.js` (`PRODUCT_IMAGES`, `PRODUCT_USE_CASES`, and if present `PRODUCT_DATASHEETS`).
3. If you rename a part number in a variants row, update the matching key in `PART_DATASHEETS` and rename the PDF in `assets/datasheets/` (or update the path).

---

## How to remove a product

1. Delete its object from the `PRODUCTS_DATA` array in `products.js`.
2. Remove its entries from `PRODUCT_IMAGES`, `PRODUCT_USE_CASES`, and (if present) `PRODUCT_DATASHEETS` in `js/data.js`.
3. Remove its part-number entries from `PART_DATASHEETS` in `js/data.js`.
4. Optionally delete the image and PDF files from `assets/images/` and `assets/datasheets/`.

---

## How to update a product image or add a carousel

Edit `PRODUCT_IMAGES` in `js/data.js`. Each key is the product `id`; the value is an array of paths.

```js
// Single image (no carousel)
'product-id': ['assets/images/product.png'],

// Multiple images (carousel arrows appear automatically)
'product-id': ['assets/images/product-front.png', 'assets/images/product-side.png'],
```

Drop the image file(s) in `assets/images/`. Supported formats: PNG, JPG, WebP.

---

## How to add a product-level datasheet

For products that have no variants table (or where one PDF covers the whole family), add to `PRODUCT_DATASHEETS` in `js/data.js`:

```js
'product-id': 'assets/datasheets/My-Product.pdf',
```

This renders a dedicated "Product Datasheet" row with View and Download buttons at the bottom of the detail modal.

---

## How to add a new filter

1. Add a `<select>` element in **`index.html`** inside `.filter-bar` (copy the pattern of an existing one, call `render()` on change).
2. Add the filter logic inside `getFiltered()` in **`js/filters.js`**.
3. Add the element ID to `hasActiveFilters()` and `clearFilters()` in **`js/filters.js`**.

---

## How to add a new product category

1. Add the category string to the `CATS` array in **`js/config.js`**.
2. Add a colour class in **`styles.css`** following the `.b-router`, `.b-gateway` pattern.
3. Add the class mapping to `catBadgeClass()` in **`js/utils.js`**.

---

## Full product schema reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | Yes | Unique kebab-case key; used across all `js/data.js` maps |
| `name` | string | Yes | Displayed on cards, modals, and compare table |
| `cat` | string | Yes | `Router` \| `Gateway` \| `Switch` \| `Energy Meter` \| `Other` |
| `desc` | string | Yes | Short description on the card and modal header |
| `cpu` | string | Yes | CPU description |
| `ram` | string | Yes | Use `'—'` if not applicable |
| `storage` | string | Yes | Use `'—'` if not applicable |
| `cell` | string | Yes | Human-readable cellular label shown in the modal |
| `cellular_gen` | string | Yes | `'5G'` \| `'4G'` \| `'none'` — drives the cellular filter |
| `wifi` | string | Yes | `'WiFi6'` \| `'WiFi5'` \| `'WiFi24'` \| `'none'` — drives the Wi-Fi filter |
| `rs485` | boolean | Yes | Drives the serial filter |
| `rs232` | boolean | Yes | Drives the serial filter |
| `ip` | string | Yes | IP rating / housing; use `''` if not specified |
| `power` | string | Yes | Power input spec |
| `ports` | number | Yes | Total Ethernet port count — drives the port filter |
| `os` | string | Yes | Operating system; use `'—'` if not applicable |
| `housing` | string | Yes | Enclosure material |
| `dims` | string | Yes | Dimensions string; use `'—'` if unknown |
| `weight` | string | Yes | Weight string; use `'—'` if unknown |
| `op_temp` | string | Yes | Operating temperature range; use `'—'` if unknown |
| `variants` | object \| null | Yes | Variants table config (see below), or `null` |

### Variants object schema

| Field | Type | Notes |
|---|---|---|
| `note` | string \| null | Optional note displayed above the table in monospace |
| `headers` | string[] | Column headers; the last one is always the part number column |
| `rows` | string[][] | Each inner array is one row; last element must be the part number |

---

## Datasheet behaviour summary

| Situation | What appears in the modal |
|---|---|
| Part number found in `PART_DATASHEETS` | **View** button (opens PDF in new tab) + **Download** button |
| Part number not in `PART_DATASHEETS` | **Contact us** link (opens pre-filled email to `sales@invendis.com`) |
| Product ID found in `PRODUCT_DATASHEETS` | Dedicated "Product Datasheet" section with View + Download |
| No variants and no product-level datasheet | No datasheet section shown |
| Variants table exists but **no** part number has a datasheet | Data Sheet column is hidden entirely |

---

## Styling and layout

Everything visual is in **`styles.css`**. Key sections are marked with comments — search for these anchors:

| What to change | Search for |
|---|---|
| Card layout and chips | `.card`, `.card-use-cases` |
| List view row | `.list-row`, `.list-head` |
| Category tab bar | `.cat-tabs`, `.cat-tab` |
| Detail modal | `.modal`, `.modal-body` |
| Image carousel | `.product-image-wrap`, `.carousel-img` |
| Variants table | `.variants-table` |
| Datasheet buttons | `.ds-btn`, `.ds-view`, `.ds-download`, `.ds-contact` |
| Compare tray | `.compare-tray` |
| Pagination | `.pagination`, `.pg-btn` |
| Responsive breakpoints | `@media (max-width: 900px)`, `@media (max-width: 768px)`, `@media (max-width: 480px)` |
