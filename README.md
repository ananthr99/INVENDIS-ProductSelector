# Product Selector — Invendis Technologies

A browser-based product catalogue and admin panel for the Invendis / SILBO product range. Customers browse, filter, compare, and download datasheets. Non-technical admins manage the catalogue through a web UI — no code required.

**Live stack:** GitHub Pages (static hosting) + GitHub Gist (live product JSON) + GitHub API (image / datasheet uploads) + Microsoft MSAL (admin authentication).

---

## Table of Contents

1. [What it does](#1-what-it-does)
2. [Architecture](#2-architecture)
3. [Project structure](#3-project-structure)
4. [Main site — features in detail](#4-main-site--features-in-detail)
5. [Admin panel — features in detail](#5-admin-panel--features-in-detail)
6. [Data flow — how a publish reaches the live site](#6-data-flow--how-a-publish-reaches-the-live-site)
7. [Product schema reference](#7-product-schema-reference)
8. [Variants table schema](#8-variants-table-schema)
9. [Datasheet behaviour](#9-datasheet-behaviour)
10. [How to manage products (admin workflow)](#10-how-to-manage-products-admin-workflow)
11. [How to manage categories](#11-how-to-manage-categories)
12. [How to manage field options (dropdowns)](#12-how-to-manage-field-options-dropdowns)
13. [How to manage site settings](#13-how-to-manage-site-settings)
14. [Setup — first-time configuration](#14-setup--first-time-configuration)
15. [Local development](#15-local-development)
16. [Styling and layout guide](#16-styling-and-layout-guide)
17. [Adding or extending features (developer reference)](#17-adding-or-extending-features-developer-reference)

---

## 1. What it does

### Main product selector (`index.html`)

- **Browse** all products in a 4-column grid or compact list view, paginated 12 per page
- **Filter** by category tab, cellular generation (5G / 4G / none), Wi-Fi standard, Ethernet port count, and serial interface (RS485 / RS232)
- **Search** by product name, description, category, or use-case keyword
- **Shareable URLs** — active filters and search query are reflected in the URL query string; paste a link to share a filtered view
- **Compare** up to 3 products side-by-side in a full-spec table; cells that differ are highlighted in yellow; the table can be copied to clipboard or printed to PDF
- **Product detail modal** — click any card (or press Enter/Space) to see the image carousel, typical use cases, full specifications, additional custom specs, product variants table, and datasheets
- **Datasheets** — each variant row shows View (opens PDF in new tab) and Download buttons when a PDF is available; otherwise shows a pre-filled "Contact us" mailto link
- **Enquire** — one-click mailto button pre-filled with the product name, sent to `sales@invendis.com`
- **Fully responsive** — 4 columns on desktop → 3 on tablet → 2 on mobile; modal becomes a bottom sheet on small screens; list view is automatically disabled on small screens
- **Keyboard accessible** — product cards are navigable by keyboard (Tab, Enter, Space); modals trap focus and restore it on close

### Admin panel (`admin/index.html`)

- **Microsoft login** — secured with MSAL (Azure AD); only allowlisted email addresses can sign in
- **Dashboard** — live clock/date widget and account info on sign-in
- **Product management** — add, edit, delete products through a form UI; changes publish to the live site immediately
- **Sort order** — assign an explicit position to each product; the main site and admin sidebar respect the order
- **Image uploads** — drag-and-drop or file picker; images are uploaded to the GitHub repo via the GitHub API
- **Datasheet uploads** — PDF upload per product and per variant; stored in the GitHub repo
- **Additional custom specs** — create any number of named key/value rows per product; they appear in the detail modal under "Additional Specifications"
- **Hidden fields** — toggle visibility of any standard spec field per product; hidden fields are excluded from the detail modal
- **Variants table** — configurable column/row table for ordering variants; last column is always the part number; per-variant datasheets are linked automatically
- **Category management** — add, remove, and colour-code category tabs; each category gets a badge colour chosen from a 10-colour palette
- **Site settings** — configure contact email, phone, address, hero subtitle, footer text, copyright, and logo URLs from the admin UI — no code changes needed
- **Field options** — manage the available values in each dropdown field (Wi-Fi, Cellular Gen, RS485, RS232); text fields can be converted to dropdowns and back
- **Activity log** — timestamped history of every save and delete; each entry stores a structured field-by-field diff; log entries are filterable, paginated, and deletable individually or in bulk
- **Manual sync** — compare the repo's committed `data/products.json` against the live Gist and overwrite either direction (recovery tool)
- **Unsaved changes warning** — navigating away from an edited product or site settings prompts a custom confirmation dialog; closing the tab triggers the browser's native beforeunload dialog

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Admin browser session                                      │
│  admin/index.html  (MSAL auth)                             │
│  admin/js/*.js     (modular JS — API, form, panels, etc.)  │
│       │                                                     │
│       ├──► Microsoft Graph API  (auth / OneDrive)          │
│       └──► GitHub API  (upload images, PDFs, update Gist)  │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────┐
│  GitHub Gist (products.json)     │  ← primary live data source
│  github.com/gists/<gistId>       │
└──────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────┐
│  GitHub Pages (static site)      │
│  index.html + js/* + styles.css  │
│                                  │
│  Data loading priority:          │
│  1. GitHub Gist API (no-cache)   │
│  2. data/products.json (repo)    │
│  3. Static PRODUCTS_DATA array   │
└──────────────────────────────────┘
```

**Key points:**
- No server, no database, no build step. Everything is plain HTML/CSS/JS.
- The Gist is the live data source. It is updated on every "Save & Publish" from the admin panel.
- `data/products.json` in the repo is the committed fallback. If the repo commit fails after a Gist write, the Gist is automatically rolled back to its previous state to keep both sources consistent.
- Images and datasheets are committed directly to `assets/images/` and `assets/datasheets/` in the repo via the GitHub API, then served through GitHub Pages.
- The main site caches data in `sessionStorage` for 2 minutes. The cache is cleared automatically when the tab regains focus, so admin changes appear on the next page refresh.

---

## 3. Project structure

```
ProductSelector/
├── index.html                   — Main site markup and script loading
├── styles.css                   — All styling (layout, cards, modal, responsive)
├── products.js                  — Static fallback product data (PRODUCTS_DATA array)
│
├── js/
│   ├── onedrive-config.js       — Configuration: Azure client ID, GitHub repo, Gist ID, allowed emails
│   ├── config.js                — Runtime state: CATS, PAGE_SIZE, viewMode, compareSet, etc.
│   ├── data.js                  — Asset maps: PRODUCT_IMAGES, PRODUCT_USE_CASES, PRODUCT_DATASHEETS, PART_DATASHEETS
│   ├── utils.js                 — Pure helpers: catBadgeClass(), wifiLabel(), srow(), hasCellular(),
│   │                              hasWifi(), hasSerial(), portsDisplay(), esc(), activateModal()
│   ├── filters.js               — Filter logic: getFiltered(), setCat(), clearFilters(),
│   │                              syncURL(), loadFromURL()
│   ├── render.js                — DOM rendering: renderGrid(), renderList(), renderPagination(),
│   │                              buildCatTabs(), updateHeroStats(), setView()
│   ├── compare.js               — Compare feature: toggleCompare(), openCompareModal(),
│   │                              copyCompare(), updateCompareTray(), showToast()
│   ├── modal.js                 — Detail modal: openDetail(), buildVariantsTable(),
│   │                              buildAdditionalSpecsSection(), buildDatasheetsSection(),
│   │                              buildImageCarousel(), navigateCarousel(), downloadFile()
│   ├── main.js                  — Bootstrap: fetchProductData() → applyData() → render();
│   │                              applySiteConfig(); keyboard event handlers
│   └── firebase-config.js       — (legacy, unused in current stack)
│
├── admin/
│   ├── index.html               — Admin panel markup; loads all admin/js scripts
│   ├── admin.css                — Admin-specific styles
│   └── js/
│       ├── admin-state.js       — Constants (COLS, CAT_COLOR_PALETTE), global state variables,
│       │                          tab switching, screen management, showConfirm, showToast, overlay
│       ├── admin-auth.js        — MSAL initialisation, getToken(), signIn(), signOut(),
│       │                          getGithubToken(), saveGithubToken(), loadAdminConfig()
│       ├── admin-api.js         — Graph API wrapper, OneDrive folder resolution, Excel read/write,
│       │                          Gist read/write (with rollback), GitHub file upload
│       ├── admin-form.js        — populateForm(), collectForm(), field visibility toggles,
│       │                          use-case tag editor, additional specs editor
│       ├── admin-media.js       — Image drag-and-drop, image preview, image removal,
│       │                          datasheet file picker, part datasheet upload UI
│       ├── admin-variants.js    — Variants table editor: add/remove columns and rows,
│       │                          cell editing, clear table
│       ├── admin-panels.js      — Categories panel, activity log (with diff modal),
│       │                          field options editor, setup panel, site settings panel
│       ├── admin-products.js    — saveProduct(), deleteProduct(), saveCats(),
│       │                          sidebar rendering, product selection, dashboard clock
│       └── admin-main.js        — Entry point: loadData(), event wiring, hideEditForm()
│
├── data/
│   └── products.json            — Committed snapshot of Gist data; repo fallback for main site
│
└── assets/
    ├── invendis_logo.png
    ├── silbo_logo.png
    ├── make-in-india.png
    ├── images/                  — Product photos (PNG/JPG); uploaded via admin
    └── datasheets/              — Product and variant datasheets (PDF); uploaded via admin
```

Scripts in `index.html` load in dependency order — no bundler is needed. Each file only references globals declared by files loaded before it.

---

## 4. Main site — features in detail

### Filter bar

| Control | Filter applied |
|---|---|
| Search input | Name, description, use-case chips (case-insensitive substring) |
| Cellular dropdown | `5G`, `4G only`, `No cellular` — maps to `cellular_gen` field |
| Wi-Fi dropdown | `Wi-Fi 6 (ax)`, `Wi-Fi 5 (ac)`, `Wi-Fi 4/2.4 GHz`, `Wi-Fi 4 (n)`, `No Wi-Fi` |
| Port count dropdown | 1–2, 3–5, 6–8, 9+ — compares against `ports` field (handles numeric and string values) |
| Serial I/O dropdown | RS485, RS232, both — checks `rs485` / `rs232` fields |

All filters are additive (AND logic). The "Clear all filters" button appears whenever any filter is active. Active filters and search queries are written to the URL query string so filtered views can be bookmarked or shared.

### Category tabs

Rendered dynamically from the `cats` array in the live JSON. Clicking a tab filters to that category. "All" is always the first tab. Badge colours on cards match the colour chosen for each category in the admin panel.

### Grid vs list view

- **Grid**: 4 columns (desktop), 3 (tablet ≤ 900px), 2 (mobile ≤ 480px); cards show image, name, full description, spec pills, first 2 use-case chips
- **List**: compact rows with name, category badge, and key specs in a single line; automatically disabled on screens ≤ 640px — switches to grid with a toast notification

Products are sorted by their explicit `order` field (lower number = first). Products with the same order (or no order set) are sorted so those with images appear before those without.

### Product cards

Each card shows:
- Product image (lazy-loaded thumbnail with shimmer placeholder while loading)
- Category badge (colour-coded per admin configuration)
- Product name
- Full description
- Spec pills: cellular generation, Wi-Fi standard, RS485, RS232, port count, IP rating
- Up to 2 use-case chips
- "Compare" checkbox and "Details →" link — both always aligned to the bottom of the card

Cards are fully keyboard-accessible: `Tab` to focus, `Enter` or `Space` to open the detail modal.

### Detail modal

Opened by clicking a card or pressing Enter/Space. The modal traps keyboard focus (Tab cycles within the modal; Escape closes it). Contains:
- Category badge + product name + description
- Image carousel (arrows and counter appear when more than 1 image; shimmer placeholder while loading; arrow key navigation while modal is open)
- Typical use-case chips (all of them, not just the first 2)
- Specification sections:
  - **Routers / Gateways / Switches / Other**: Connectivity (cellular, Wi-Fi, Ethernet ports, RS485, RS232) + Hardware (CPU, RAM, Storage, power, IP/housing, enclosure, dimensions, weight, operating temp) + Software (OS, if set)
  - **Energy Meters**: Communication (RS485, RS232, power supply) + Physical (enclosure, IP, dimensions, weight, operating temp)
- **Additional Specifications** — any custom fields added in admin; appear after the standard spec sections
- **Product Variants** table — ordering / configuration table with optional per-variant datasheet buttons
- **Datasheet** section — product-level PDF with View and Download buttons (Download shows `…` while fetching)
- **Enquire** button — opens a pre-filled email to `sales@invendis.com`
- **+ Compare** button — adds the product to the compare tray

Standard spec fields hidden via the admin toggle are excluded from the modal for that product.

### Compare feature

Up to 3 products can be compared. Selected products appear as chips in a tray at the bottom of the page. Clicking "Compare now" opens an accessible modal with:
- Full spec table — rows with differing values highlighted in yellow
- **Copy table** button — copies the table as tab-separated text to the clipboard
- **Print / PDF** button — calls `window.print()` (use browser's "Save as PDF" option)
- Enquire mailto link pre-filled with all selected product names

---

## 5. Admin panel — features in detail

### Authentication

The admin panel uses MSAL (Microsoft Authentication Library) with an Azure App Registration. Only email addresses listed in `ONEDRIVE_CONFIG.allowedEmails` can access the dashboard. Anyone else sees a "Not authorised" error after signing in.

A GitHub Personal Access Token (PAT) with `repo` and `gist` scopes is required to save changes. This token is entered once in the Setup tab and is stored in `localStorage` so it auto-loads on future sign-ins. The yellow token warning banner at the top of the dashboard disappears once a valid token is set.

### Dashboard

The landing screen after sign-in shows a live clock, current date, and the signed-in user's name and email. This tab has no sidebar — it appears immediately after login before any product is selected.

### Dashboard layout (Products/Categories/Fields/etc. tabs)

```
┌──────────────────────────────────────────────────────────────┐
│ Header: Logo | "Product Admin" | user name/email | Sign out  │
├──────────────┬───────────────────────────────────────────────┤
│  Sidebar     │  Tab bar: Dashboard | Products | Categories | │
│              │           Field Options | Site Settings |     │
│  Search      │           Setup | Activity Log                │
│  Cat filter  ├───────────────────────────────────────────────┤
│  Product     │  Tab content panel                            │
│  list        │                                               │
│              │                                               │
│  [+ Add]     │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

The sidebar is hidden on the Dashboard tab and shown on all others.

### Products tab — editing a product

Select a product from the sidebar to open its edit form. Fields are organised into sections:

**Basic Info**
- Product ID (slug, no spaces — must be unique across all products; validated on save)
- Display Name
- Category (dropdown from the categories list)
- Sort Order (lower number = appears earlier; duplicate order numbers are rejected)
- Description

**Use Cases**
- Tag editor: type a use case and press Enter to add; click × to remove
- All tags appear as chips in the detail modal; first 2 appear on the grid card

**Specifications**

| Field | Type | Notes |
|---|---|---|
| CPU | Text | Free text |
| RAM | Text | Free text |
| Storage | Text | Free text |
| Cellular Module | Text | Human-readable label, e.g. "EC25-AF" |
| Cellular Gen | Dropdown | 5G / 4G / 3G / — |
| Wi-Fi | Dropdown | WiFi6 / WiFi5 / WiFi4/2.4GHz / WiFi4 / — |
| RS485 | Dropdown | Yes / No / Optional / — |
| RS232 | Dropdown | Yes / No / Optional / — |
| IP Rating | Text | Free text, e.g. "IP30" |
| Power Input | Text | Free text, e.g. "9–36V DC" |
| Ethernet Ports | Text | Number or string, e.g. "4" or "4+1" |
| OS | Text | Free text, e.g. "OpenWrt" |
| Housing | Text | Free text, e.g. "Aluminium" |
| Dimensions | Text | Free text, e.g. "140×90×30 mm" |
| Weight | Text | Free text |
| Operating Temp | Text | Free text, e.g. "-20–60 °C" |

Each field has an eye-icon visibility toggle. Toggling a field off adds it to `hidden_fields` — it is excluded from the detail modal on the main site for that product.

**Additional Specs**

Click "+ Add Spec" to add a custom named field. Each row has a name input and a value input. No limit on the number of rows. They appear under "Additional Specifications" in the detail modal in the order they were added.

**Product Images**

- Click "+ Add Images" to upload one or more image files (PNG, JPG, WebP)
- Uploaded images are committed to `assets/images/` in the GitHub repo
- The first image is the card thumbnail and the primary carousel image
- Images can be removed individually (× button on the thumbnail)

**Product Datasheet**

- Click "Upload PDF" to attach a product-level datasheet
- The PDF is committed to `assets/datasheets/` via the GitHub API
- Appears in the detail modal as a "Product Datasheet" section with View and Download buttons
- Set the datasheet URL to the string `contact_us` (manually or via admin) to show a "Contact us" mailto link instead of download buttons

**Variants**

- Optional table note (text above the table in the modal)
- "+ Add Column" / "+ Add Row" buttons build the table
- The last column is always the Part Number column
- Each row's part number can be linked to a per-variant datasheet PDF
- "Clear All" removes the entire variants table
- In the main site: cells with `✓` render as green; cells with `—` render as grey

**Save & Publish**

The blue "Save & Publish" button:
1. Validates Product ID (no spaces, unique across all products)
2. Validates Sort Order (no duplicates)
3. Uploads any pending image or PDF files to GitHub
4. Re-reads the latest Gist data to avoid overwriting concurrent changes
5. Re-validates Sort Order against the refreshed data
6. Serialises the full product catalogue to JSON
7. Writes the JSON to the GitHub Gist (primary)
8. Commits `data/products.json` to the repo (fallback) — if this step fails, the Gist is rolled back to its previous state automatically
9. Appends a structured diff entry to the activity log

### Categories tab

Add or remove category tabs. Each category has a colour picker that selects from a 10-colour palette (Blue, Green, Orange, Purple, Gray, Teal, Red, Indigo, Yellow, Pink). The chosen colour determines the badge colour on cards and in the detail modal. "All" is always shown first automatically and cannot be removed. Click "Save & Publish" in this tab to push changes live.

### Site Settings tab

Configure the following without touching code:

| Setting | Where it appears |
|---|---|
| Contact email | Footer contact section, enquire buttons, datasheet "Contact us" links |
| Phone number | Footer contact section |
| Address | Footer contact section |
| Hero subtitle | Hero banner below the main heading |
| Footer brand text | Footer tagline |
| Copyright line | Footer bottom bar |
| Invendis URL | Header and footer brand link |
| SILBO URL | Footer brand link |
| Invendis logo | Header logo image |
| SILBO logo | Footer logo image |
| Make in India logo | Footer logo image |

Click "Save Site Settings" to push changes to the Gist. They take effect on the next page load of the main site (or immediately on tab focus, since the cache is cleared on visibility change).

### Setup tab

- **GitHub Token** — enter your PAT once; it is saved to `localStorage`. The token warning banner disappears once set
- **GitHub Gist** — shows the Gist ID and raw URL. On the first Save & Publish, the Gist is created automatically; copy the ID and raw URL into `js/onedrive-config.js`
- **Status indicators** — three dots showing: Azure App Registration configured, GitHub repo configured, `productsJsonUrl` set
- **Manual Sync** — "Load & Compare" fetches `data/products.json` from the repo and compares it against the live Gist, showing Added / Removed / Modified / Unchanged entries. "Overwrite Gist with Repo Content" replaces the Gist with the repo file (recovery when the Gist has bad data)

### Activity Log tab

Every Save & Publish and Delete action is recorded with:
- Timestamp and action type
- Product name and ID
- Signed-in user's email
- Structured field-by-field diff (before → after values)

The log is **paginated** (20 entries per page) and **filterable** by search text, user, date range, and action type. Entries with a field diff show a **Details** button that opens a diff modal showing:
- Changed Fields table (old value → new value)
- Description text before/after
- Image and datasheet change badges
- Use Cases, Hidden Fields, Additional Specs, and Variants change summaries

Log entries can be selected individually (checkbox) or all-at-once, then deleted by composite key (timestamp + user) — stable even when new entries are prepended. "Delete All" wipes the entire log. Changes are written back to the Gist.

### Field Options tab

Manage the available values in each dropdown field. For built-in dropdowns (Wi-Fi, Cellular Gen, RS485, RS232):
- Add new option values as chips
- Remove existing values
- Click a chip label to rename it

Text fields (CPU, RAM, Storage, Cellular Module, IP Rating, Power Input, OS, Dimensions, Weight, Housing, Operating Temp) are free-text by default. A "Make dropdown" button converts any text field to a dropdown managed here. A "Revert to text" button converts it back. Click "Save Field Options" to push changes to the Gist.

---

## 6. Data flow — how a publish reaches the live site

```
Admin: Save & Publish
        │
        ├─ 1. Validate: Product ID unique, no spaces; Sort Order not duplicate
        │
        ├─ 2. Upload new images/PDFs → GitHub API → assets/ in repo
        │
        ├─ 3. Re-read Gist → re-validate Sort Order against latest data
        │
        ├─ 4. Serialise products to JSON (buildJsonData)
        │       includes: id, name, cat, order, desc, all spec fields,
        │                 images[], use_cases[], hidden_fields[],
        │                 additional_specs[], variants, part_datasheets,
        │                 datasheet, cats, catColors, dropdowns, siteConfig
        │
        ├─ 5. Write products.json → GitHub Gist (primary live source)
        │
        ├─ 6. Commit data/products.json → GitHub repo (fallback)
        │       If this step fails → roll back the Gist to the previous snapshot
        │
        └─ 7. Append activity log entry (with structured diff) → Gist

Main site: page load
        │
        ├─ 1. Check sessionStorage cache (2-minute TTL)
        │       Cache is cleared on tab focus (visibilitychange) so admin
        │       changes appear on the very next page refresh
        │
        ├─ 2. Fetch Gist via GitHub API (cache: no-store) → parse JSON
        │       applyData() extracts images, use_cases, datasheets into maps;
        │       applies catColors, siteConfig; restores URL filter state
        │
        ├─ 3. If Gist fails → fetch data/products.json from repo
        │
        └─ 4. If both fail → use static PRODUCTS_DATA from products.js
```

---

## 7. Product schema reference

All fields are stored in the products array in the Gist JSON.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique slug, no spaces. Used as the lookup key in all asset maps. Never change after creation without updating all maps. |
| `name` | string | Display name on cards, modals, and compare table |
| `cat` | string | Must match one of the configured categories |
| `order` | number \| null | Sort position (lower = first); `null` means unsorted (appears after numbered products) |
| `desc` | string | Description shown on the card and in the modal header |
| `cpu` | string | CPU description |
| `ram` | string | Use `—` if not applicable |
| `storage` | string | Use `—` if not applicable |
| `cell` | string | Human-readable cellular label, e.g. "4G" or "4G/5G (dual)" |
| `cellular_gen` | string | `5G` \| `4G` \| `3G` \| `—` — drives the cellular filter |
| `wifi` | string | `WiFi6` \| `WiFi5` \| `WiFi4/2.4GHz` \| `WiFi4` \| `—` — drives the Wi-Fi filter |
| `rs485` | string | `Yes` \| `No` \| `Optional` \| `—` |
| `rs232` | string | `Yes` \| `No` \| `Optional` \| `—` |
| `ip` | string | IP rating, e.g. `IP30`; leave empty if not rated |
| `power` | string | Power input specification, e.g. `9–36V DC` |
| `ports` | number \| string | Ethernet port count — numeric (`4`) or string (`"4+1"`); drives the port count filter |
| `os` | string | Operating system; use `—` if not applicable |
| `housing` | string | Enclosure material, e.g. `Aluminium` |
| `dims` | string | Dimensions string, e.g. `140×90×30 mm`; use `—` if unknown |
| `weight` | string | Weight, e.g. `350 g`; use `—` if unknown |
| `op_temp` | string | Operating temperature range, e.g. `-20–60 °C`; use `—` if unknown |
| `images` | string[] | Array of raw GitHub URLs, e.g. `["https://raw.githubusercontent.com/..."]` |
| `use_cases` | string[] | Array of use-case label strings |
| `hidden_fields` | string[] | Field keys excluded from the detail modal, e.g. `["cpu","ram","storage"]` |
| `additional_specs` | object[] | Custom spec rows: `[{ "k": "HDMI", "v": "1 × HDMI 2.0" }, ...]` |
| `datasheet` | string \| null | Raw GitHub URL to the product-level PDF, `"contact_us"` to show a contact link, or `null` |
| `variants` | object \| null | Variants table config (see below), or `null` |
| `part_datasheets` | object | Map of part number → PDF URL for per-variant datasheets; use `"contact_us"` as a value for unavailable datasheets |

### Hideable field keys (for `hidden_fields`)

| Key | Field shown in modal |
|---|---|
| `cpu` | CPU |
| `ram` | RAM |
| `storage` | Storage |
| `cellular_gen` | Cellular |
| `wifi` | Wi-Fi |
| `ports` | Ethernet ports |
| `rs485` | RS485 |
| `rs232` | RS232 |
| `ip` | IP / Housing |
| `power` | Power input |
| `os` | Operating system |
| `housing` | Enclosure |
| `dims` | Dimensions |
| `weight` | Weight |
| `op_temp` | Operating temp |

---

## 8. Variants table schema

```json
{
  "note": "Optional note shown above the table (or null to omit)",
  "headers": ["Column 1", "Column 2", "Part No."],
  "rows": [
    ["Value A", "Value B", "PART-001"],
    ["Value C", "Value D", "PART-002"]
  ]
}
```

**Rules:**
- The last column is always the Part Number. Do not add a "Data Sheet" column to `headers` — it is appended automatically when at least one part number has a matching entry in `part_datasheets`.
- Use `✓` in a cell for a green tick.
- Use `—` in a cell for a grey dash.
- Part numbers can include parenthetical suffixes like `PART-001 (Rev B)` — the datasheet lookup strips the suffix automatically.
- If no part number in the table has a datasheet, the Data Sheet column is hidden entirely.

---

## 9. Datasheet behaviour

| Situation | What appears in the detail modal |
|---|---|
| Part number found in `part_datasheets` with a URL | **View** button (new tab) + **Download** button |
| Part number in `part_datasheets` with value `"contact_us"` | **Contact us** link (pre-filled email to `sales@invendis.com`) |
| Part number not in `part_datasheets` | **Contact us** link |
| Product has a `datasheet` URL | "Product Datasheet" section with View + Download buttons |
| Product `datasheet` is `"contact_us"` | "Product Datasheet" section with Contact us link |
| No variants and no product datasheet | No datasheet section shown |
| Variants exist but no part has a datasheet | Data Sheet column is hidden from the variants table |

---

## 10. How to manage products (admin workflow)

### Add a new product

1. Open `admin/index.html` and sign in with your Microsoft account
2. Click **+ Add Product** in the sidebar
3. Fill in the Basic Info — Product ID must be unique, contain no spaces, and be a simple slug (e.g. `rv-xx`)
4. Set a Sort Order if you want this product to appear in a specific position
5. Add use cases via the tag editor
6. Fill in specifications; toggle the eye icon to hide any field from the public modal
7. Add any custom fields with **+ Add Spec**
8. Upload product images via **+ Add Images**
9. Upload a product datasheet PDF if available via **Upload PDF**
10. Add variants via **+ Add Column / + Add Row** if the product has ordering variants
11. Click **Save & Publish** — changes go live immediately

### Edit an existing product

1. Select the product from the sidebar (use the search box or category filter to narrow the list)
2. Make your changes
3. Click **Save & Publish**

If you navigate away from an edited product without saving, a confirmation dialog appears. Closing the browser tab while there are unsaved changes triggers the browser's native warning.

### Delete a product

1. Select the product from the sidebar
2. Click **Delete** in the form actions bar
3. Confirm the deletion — the product is removed from the Gist and the repo immediately

### Reorder products

Set the **Sort Order** field on each product. Lower numbers appear first. Products with no sort order appear after numbered products, in the order they were added. Duplicate sort order numbers are rejected with an error.

---

## 11. How to manage categories

1. Go to the **Categories** tab in the admin panel
2. Add a new category name in the input at the bottom and click **Add**
3. Choose a badge colour from the colour picker next to each category row
4. Remove a category with the × button (products assigned to a deleted category are not automatically reassigned — update them manually in the Products tab)
5. Click **Save & Publish** in the Categories tab to push changes live

The chosen colours are stored in `catColors` in the Gist and injected as dynamic CSS on the main site — no code changes are needed to add colour for new categories.

---

## 12. How to manage field options (dropdowns)

1. Go to the **Field Options** tab in the admin panel
2. For each dropdown field (Wi-Fi, Cellular Gen, RS485, RS232):
   - Add a new option by typing in the add-row input
   - Remove an option by clicking the × chip button
   - Rename an option by clicking its label and editing inline
3. For text fields (CPU, RAM, Storage, etc.):
   - Click **Make dropdown** to convert a text field to a dropdown and manage its values here
   - Click **Revert to text** to convert it back to a free-text input
4. Click **Save Field Options** — changes take effect in the product form immediately and are written to the Gist

---

## 13. How to manage site settings

1. Go to the **Site Settings** tab in the admin panel
2. Edit any of the configurable values (email, phone, address, hero text, footer text, copyright, logo images, brand URLs)
3. Click **Save Site Settings** — changes are written to the Gist and appear on the main site on next load

Logo images can be replaced by uploading a new file — the image is committed to the repo via the GitHub API and the URL is updated automatically.

---

## 14. Setup — first-time configuration

### Prerequisites

- A Microsoft 365 or personal Microsoft account
- A GitHub account with access to the `ananthr99/INVENDIS-ProductSelector` repo
- A GitHub Personal Access Token (PAT) with `repo` and `gist` scopes

### `js/onedrive-config.js`

All configuration lives here. Key values:

| Key | Purpose |
|---|---|
| `clientId` | Azure App Registration Application (client) ID |
| `tenantId` | Azure tenant ID (`common` works for personal + work accounts) |
| `folderPath` | OneDrive folder name used for admin context resolution |
| `githubOwner` | GitHub username or org that owns the repo |
| `githubRepo` | GitHub repo name |
| `githubBranch` | Branch to commit assets and `data/products.json` to |
| `gistId` | GitHub Gist ID (set after first Save & Publish) |
| `productsJsonUrl` | Raw Gist URL fetched by the main site |
| `allowedEmails` | Array of Microsoft account emails permitted to use the admin panel |

### Azure App Registration (one-time, ~10 min)

1. Go to `portal.azure.com` → Azure Active Directory → App registrations
2. Click **New registration** → Name it "ProductSelector Admin" → Register
3. Copy the **Application (client) ID** into `clientId` in `onedrive-config.js`
4. Go to **Authentication** → Add platform → **Single-page application**
5. Set the redirect URI to the URL of `admin/index.html` on your hosted domain
6. Go to **API permissions** → Add a permission → Microsoft Graph → Delegated → add `Files.ReadWrite` and `User.Read`

### GitHub Token

1. Go to github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate a new token with `repo` and `gist` scopes
3. Enter the token in the admin panel's Setup tab and click **Save**

The token is stored in `localStorage`. It persists across browser sessions until the token is revoked or the browser data is cleared — re-entry is only required if you use a new device or clear browser storage.

### Gist setup

The Gist is created automatically on the first Save & Publish. After the first save:
1. Copy the Gist ID from the Setup tab
2. Paste it into `gistId` in `js/onedrive-config.js`
3. Copy the raw URL and paste it into `productsJsonUrl` in `js/onedrive-config.js`
4. Commit and push `js/onedrive-config.js` to the repo

---

## 15. Local development

No build step is needed. Serve the project root with any static file server:

```bash
# Python
python -m http.server 8080

# Node (npx)
npx serve .

# VS Code Live Server extension
# Right-click index.html → Open with Live Server
```

Open `http://localhost:8080` for the main site, `http://localhost:8080/admin/` for the admin panel.

**Note on data loading:** Locally, the Gist fetch will succeed if you have a Gist ID configured and are online. The `data/products.json` fallback is served by the local file server. If both fail, the static `PRODUCTS_DATA` array in `products.js` is used.

**Cache busting:** Script tags in `index.html` include a `?v=` query string (e.g. `?v=e4a71b3`). Bump this value whenever you need browsers to reload a script file after a code change. All scripts share the same version string for consistency.

---

## 16. Styling and layout guide

All styles are in `styles.css` (main site) and `admin/admin.css` (admin panel). Neither file is minified — search for the class names below.

| What to change | Class / selector to search for |
|---|---|
| Page header | `.header`, `.header-inner`, `.header-left`, `.header-right` |
| Hero banner | `.hero`, `.hero-inner`, `.hero-stats` |
| Filter bar | `.filter-bar`, `.search-wrap` |
| Category tabs | `.cat-tabs`, `.cat-tab` |
| Grid layout | `.grid-view` — currently `repeat(4, minmax(0, 1fr))` on desktop |
| List view rows | `.list-view`, `.list-head`, `.list-row` |
| Product cards | `.card`, `.card-name`, `.card-desc`, `.card-specs`, `.card-use-cases`, `.card-footer` |
| Category badge colours | Dynamic CSS injected by `injectCatColorStyles()` based on admin config; fallback classes: `.b-router`, `.b-gateway`, `.b-switch`, `.b-energy`, `.b-other`, `.b-pcb` |
| Spec pills on cards | `.spec-pill`, `.spec-pill.highlight`, `.spec-pill.warn` |
| Detail modal | `.modal`, `.modal-overlay`, `.modal-header`, `.modal-body` |
| Modal spec sections | `.spec-section`, `.spec-section-title`, `.spec-row` |
| Image carousel | `.product-image-wrap`, `.product-image-wrap.loading`, `.carousel-img`, `.carousel-btn` |
| Variants table | `.variants-table`, `.variants-table-wrap`, `.variants-section` |
| Datasheet buttons | `.ds-btn`, `.ds-view`, `.ds-download`, `.ds-contact` |
| Compare tray | `.compare-tray`, `.compare-tray-chips` |
| Compare modal | `.modal.compare-modal`, `.compare-table`, `.diff-row` |
| Pagination | `.pagination`, `.pg-btn` |
| Toast notifications | `.toast` (main site); `#toast.toast` (admin) |
| Footer | `.footer-inner`, `.footer-brand`, `.footer-contact`, `.footer-bottom` |
| Admin diff modal | `.log-diff-modal` (in `admin/admin.css`) |

### Responsive breakpoints

| Breakpoint | Changes |
|---|---|
| `≤ 900px` (tablet) | Grid → 3 columns; list thumbnail layout adjusts |
| `≤ 768px` | Filter bar stacks vertically; header contact links hidden |
| `≤ 640px` | List view disabled; auto-switches to grid |
| `≤ 480px` (mobile) | Grid → 2 columns; modal becomes full-width bottom sheet |

---

## 17. Adding or extending features (developer reference)

### Add a new filter

1. Add a `<select>` in `index.html` inside `.filter-bar`; call `currentPage=1;render()` on change
2. Add the filter logic in `getFiltered()` in `js/filters.js`
3. Add the element ID to `hasActiveFilters()` and reset it in `clearFilters()` in `js/filters.js`
4. Add a `params.set()` call in `syncURL()` and a corresponding `document.getElementById().value = p.get()` in `loadFromURL()` in `js/filters.js` so the filter persists in the URL

### Add a new product field

1. Add the `<input>` or `<select>` to the edit form in `admin/index.html`
2. Add the field key to the `COLS` array in `admin/js/admin-state.js` (or add an explicit property in `buildJsonData()` in `admin/js/admin-api.js` for array/object fields)
3. Populate the field in `populateForm()` in `admin/js/admin-form.js`
4. Read the field in `collectForm()` in `admin/js/admin-form.js`
5. Display it in the appropriate section of `openDetail()` in `js/modal.js`
6. Add it to the product schema reference in this README

### Add a new product category

1. Add the category name in the admin Categories tab → Save & Publish
2. The badge colour is set via the colour picker in the Categories tab — no CSS changes needed
3. If you need to add a hardcoded fallback class (for the static `PRODUCTS_DATA` array), add a CSS class in `styles.css` (e.g. `.b-newcat { background: ...; color: ...; }`) and map it in `catBadgeClass()` in `js/utils.js`

### Add a new spec section to the detail modal

The modal body is built in `openDetail()` in `js/modal.js`. Add a new `<div class="spec-section">` block alongside the existing sections. Use `srow(label, value)` from `js/utils.js` to render each row. Use `isHf(p, 'field_key')` to respect hidden field toggles.

### Add a new site-configurable value

1. Add the key and default value to `DEFAULT_SITE_CONFIG` in `admin/js/admin-state.js`
2. Add a `data-cfg="keyName"` attribute to all elements in `index.html` that should receive the value
3. Add the corresponding `if (cfg.keyName) { ... }` branch in `applySiteConfig()` in `js/main.js`
4. Add an input field in the Site Settings panel in `admin/index.html` and wire it in `renderSiteSettings()` / `saveSiteSettings()` in `admin/js/admin-panels.js`

### Bump the script cache version

Change the `?v=` suffix on all `<script>` tags in `index.html` to a new short hash (any string) after a code change that you need browsers to pick up immediately. All scripts share the same version string for consistency.

### Recovery: Gist has bad data

Use the **Manual Sync** tool in the admin Setup tab. Click "Load & Compare" to see the diff between the repo file and the live Gist, then "Overwrite Gist with Repo Content" to restore from the last committed `data/products.json`.

### Recovery: repo is ahead of the Gist

If you have manually edited `data/products.json` in the repo and want to push it to the Gist, use the same Manual Sync tool — "Load & Compare" fetches both, and "Overwrite Gist with Repo Content" pushes the repo version live.
