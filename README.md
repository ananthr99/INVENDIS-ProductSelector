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
13. [Setup — first-time configuration](#13-setup--first-time-configuration)
14. [Local development](#14-local-development)
15. [Styling and layout guide](#15-styling-and-layout-guide)
16. [Adding or extending features (developer reference)](#16-adding-or-extending-features-developer-reference)

---

## 1. What it does

### Main product selector (`index.html`)

- **Browse** all products in a 4-column grid or compact list view, paginated 12 per page
- **Filter** by category tab, cellular generation (5G / 4G / none), Wi-Fi standard, Ethernet port count, and serial interface (RS485 / RS232)
- **Search** by product name, description, category, or CPU keyword
- **Compare** up to 3 products side-by-side in a full-spec table; cells that differ are highlighted in yellow
- **Product detail modal** — click any card to see the image carousel, typical use cases, full specifications, additional custom specs, product variants table, and datasheets
- **Datasheets** — each variant row shows View (opens PDF in new tab) and Download buttons when a PDF is available; otherwise shows a pre-filled "Contact us" mailto link
- **Enquire** — one-click mailto button pre-filled with the product name, sent to `sales@invendis.com`
- **Fully responsive** — 4 columns on desktop → 3 on tablet → 2 on mobile; modal becomes a bottom sheet on small screens

### Admin panel (`admin/index.html`)

- **Microsoft login** — secured with MSAL (Azure AD); only allowlisted email addresses can sign in
- **Product management** — add, edit, delete products through a form UI; changes publish to the live site immediately
- **Image uploads** — drag-and-drop or file picker; images are uploaded to the GitHub repo via the GitHub API
- **Datasheet uploads** — PDF upload per product and per variant; stored in the GitHub repo
- **Additional custom specs** — create any number of named key/value rows per product (e.g. HDMI: 1 port, USB: 2 ports); they appear in the detail modal under "Additional Specifications"
- **Hidden fields** — toggle visibility of any standard spec field per product; hidden fields are excluded from the detail modal
- **Variants table** — configurable column/row table for ordering variants; last column is always the part number; per-variant datasheets are linked automatically
- **Category management** — add or remove category tabs on the main site
- **Field options** — manage the available values in each dropdown field (Wi-Fi, Cellular Gen, RS485, RS232); fields can also be converted to free-text
- **Activity log** — timestamped history of every save and delete, stored in the GitHub Gist alongside the product data; log entries can be deleted individually or in bulk
- **Manual sync** — compare the repo's committed `data/products.json` against the live Gist and overwrite the Gist if needed (recovery tool)
- **GitHub token storage** — token is saved to the browser and to OneDrive so it auto-loads on future sign-ins from any browser

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Admin browser session                                      │
│  admin/index.html  (MSAL auth, all logic inline)           │
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
- `data/products.json` in the repo is the fallback. It is committed by the admin panel after each save (via GitHub API). It becomes active within ~1 minute if the Gist API rate-limits.
- Images and datasheets are committed directly to the `assets/images/` and `assets/datasheets/` folders in the repo via GitHub API, and served through GitHub Pages.

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
│   ├── utils.js                 — Pure helpers: catBadgeClass(), wifiLabel(), srow(), hasCellular(), hasWifi(), hasSerial()
│   ├── filters.js               — Filter logic: getFiltered(), hasActiveFilters(), setCat(), clearFilters()
│   ├── render.js                — DOM rendering: grid cards, list rows, pagination bar, category tabs, hero stats
│   ├── compare.js               — Compare feature: toggleCompare(), compare tray, openCompareModal()
│   ├── modal.js                 — Detail modal: openDetail(), buildVariantsTable(), buildAdditionalSpecsSection(),
│   │                              buildDatasheetsSection(), buildImageCarousel(), downloadFile()
│   ├── main.js                  — Bootstrap: fetchProductData() → applyData() → render(); Escape key handler
│   └── firebase-config.js       — (legacy, unused in current stack)
│
├── admin/
│   └── index.html               — Full admin panel (all JS inline); MSAL auth, product form, GitHub API calls
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
| Search input | Name, description, category, CPU (case-insensitive substring) |
| Cellular dropdown | `5G`, `4G only`, `No cellular` — maps to `cellular_gen` field |
| Wi-Fi dropdown | `Wi-Fi 6 (ax)`, `Wi-Fi 5 (ac)`, `Wi-Fi 4/2.4 GHz`, `Wi-Fi 4 (n)`, `No Wi-Fi` |
| Port count dropdown | 1–2, 3–5, 6–8, 9+ — compares against `ports` numeric field |
| Serial I/O dropdown | RS485, RS232, both — checks `rs485` / `rs232` fields |

All filters are additive (AND logic). The "Clear all filters" button appears whenever any filter is active.

### Category tabs

Rendered dynamically from the `cats` array in the live JSON. Clicking a tab filters to that category. "All" is always the first tab.

### Grid vs list view

- **Grid**: 4 columns (desktop), 3 (tablet ≤ 900px), 2 (mobile ≤ 480px); cards show image, name, full description, spec pills, first 2 use-case chips
- **List**: compact rows with name, category badge, and key specs in a single line

Products with images are sorted first within each filter result.

### Product cards

Each card shows:
- Product image (thumbnail)
- Category badge (colour-coded)
- Product name
- Full description (not truncated)
- Spec pills: cellular generation, Wi-Fi standard, IP rating (highlighted if present)
- Up to 2 use-case chips
- "Compare" checkbox and "Details →" link — both always aligned to the bottom of the card regardless of content height

### Detail modal

Opened by clicking "Details →" or a card. Contains:
- Category badge + product name + description
- Image carousel (arrows appear when more than 1 image; counter shows "1 / N")
- Typical use cases chips (all, not just the first 2)
- Specification sections:
  - **Routers / Gateways / Switches / Other**: Connectivity (cellular, Wi-Fi, Ethernet ports, RS485, RS232) + Hardware (CPU, RAM, Storage, power, IP/housing, enclosure, dimensions, weight, operating temp) + Software (OS, if set)
  - **Energy Meters**: Communication (RS485, RS232, power supply) + Physical (enclosure, IP, dimensions, weight, operating temp)
- **Additional Specifications** — any custom fields added in admin (key/value rows); appear after the standard spec sections
- **Product Variants** table — ordering / configuration table with optional per-variant datasheet buttons
- **Datasheet** section — product-level PDF with View and Download buttons
- **Enquire** button — opens a pre-filled email to `sales@invendis.com`
- **+ Compare** button — adds the product to the compare tray

### Compare feature

Up to 3 products can be compared. Selected products appear as chips in a tray at the bottom of the page. Clicking "Compare now" opens a modal with a full spec table — cells that differ between products are highlighted in yellow.

---

## 5. Admin panel — features in detail

### Authentication

The admin panel uses MSAL (Microsoft Authentication Library) with an Azure App Registration. Only email addresses listed in `ONEDRIVE_CONFIG.allowedEmails` in `js/onedrive-config.js` can access the dashboard. Anyone else gets a "Not authorised" error after signing in.

A GitHub Personal Access Token (PAT) with `repo` + `gist` scopes is required to save changes. This token is entered once in the Setup tab and is stored in `localStorage` and in OneDrive, so it auto-loads on future sign-ins from any browser.

### Dashboard layout

```
┌──────────────────────────────────────────────────────┐
│ Header: Logo | "Product Admin" | user email | Sign out │
├──────────────┬───────────────────────────────────────┤
│  Sidebar     │  Tab bar: Products | Categories |     │
│              │           Setup | Activity | Field     │
│  Search      │           Options                     │
│  Cat filter  ├───────────────────────────────────────┤
│  Product     │  Tab content panel                    │
│  list        │                                       │
│              │                                       │
│  [+ Add]     │                                       │
└──────────────┴───────────────────────────────────────┘
```

### Products tab — editing a product

Select a product from the sidebar to open its edit form. Fields are organised into sections:

**Basic Info**
- Product ID (slug, no spaces — used as the key across all data maps)
- Display Name
- Category (dropdown from the categories list)
- Sort Order (lower number = appears earlier in the list)
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
| Ethernet Ports | Text | Number of ports |
| OS | Text | Free text, e.g. "OpenWrt" |
| Housing | Text | Free text, e.g. "Aluminium" |
| Dimensions | Text | Free text, e.g. "140×90×30 mm" |
| Weight | Text | Free text |
| Operating Temp | Text | Free text, e.g. "-20–60 °C" |

Each text field has an eye-icon visibility toggle. Toggling a field off adds it to `hidden_fields` — it is then excluded from the main site's detail modal for that product. Fields with the "hidden" badge are visually dimmed in the admin form.

**Additional Specs**

Click "+ Add Spec" to add a custom named field. Each row has:
- A name input (left) — e.g. "HDMI", "USB", "Display Output"
- A value input (right) — e.g. "1 × HDMI 2.0", "2 × USB 3.0"
- A delete (×) button to remove the row

There is no limit on the number of additional spec rows. They appear in the main site's detail modal under "Additional Specifications" in the order they were added.

**Product Images**

- Click "+ Add Images" to upload one or more image files (PNG, JPG, WebP)
- Uploaded images are committed to `assets/images/` in the GitHub repo via the GitHub API
- The first image is the card thumbnail and the primary carousel image; additional images appear in the carousel
- Images can be removed individually (× button on the thumbnail)
- The "Primary" badge marks the first image

**Product Datasheet**

- Click "Upload PDF" to attach a product-level datasheet
- The PDF is committed to `assets/datasheets/` via the GitHub API
- Appears in the detail modal as a "Product Datasheet" section with View and Download buttons

**Variants**

- Optional table note (text above the table)
- "+ Add Column" / "+ Add Row" buttons build the table
- The last column is always the Part Number column
- Each row's part number cell can be linked to a per-variant datasheet (uploaded via the datasheet upload field for that variant in the table)
- "Clear All" removes the entire variants table
- In the main site: cells with `✓` render as green; cells with `—` render as grey

**Save & Publish**

The blue "Save & Publish" button at the top of the edit form:
1. Reads all form fields
2. Uploads any pending image or PDF files to GitHub via the API
3. Serialises the full product catalogue to JSON (`buildJsonData()`)
4. Writes the JSON to the GitHub Gist
5. Commits `data/products.json` to the repo as a fallback
6. Appends an entry to the activity log (also stored in the Gist)

The main site picks up the change immediately on next load (Gist is always fetched with `cache: 'no-store'`).

### Categories tab

Add or remove category tabs that appear on the main site. "All" is always shown first automatically and cannot be removed. Click "Save & Publish" in this tab to push the updated category list to the Gist.

### Setup tab

- **OneDrive Storage** — shows the configured OneDrive folder path and its expected contents
- **GitHub Token** — enter your PAT once; it is saved to localStorage and OneDrive for future sessions. The token warning banner at the top of the dashboard disappears once a valid token is entered
- **GitHub Gist** — shows the Gist ID and raw URL. On first ever save, the Gist is created automatically; the ID is stored in `onedrive-config.js` (requires a code commit to persist across deployments)
- **Status** — three indicator dots: config loaded, GitHub token set, Gist URL configured
- **Manual Sync** — "Load & Compare" fetches `data/products.json` from the repo and compares it against the live Gist, showing Added / Removed / Modified / Unchanged entries. "Overwrite Gist with Repo Content" replaces the Gist with the repo file (recovery tool for when the Gist has corrupted or missing data)

### Activity Log tab

Every Save & Publish and Delete action is recorded with:
- Timestamp
- Action type (saved / deleted)
- Product name and ID
- List of changed fields (field name + old value → new value)
- Who performed the action (Microsoft account email)

Log entries can be selected individually (checkbox) or all-at-once, then deleted. "Delete All" wipes the entire log. Changes to the log are written back to the Gist.

### Field Options tab

Manage the available values in each dropdown field. For built-in dropdowns (Wi-Fi, Cellular Gen, RS485, RS232):
- Add new option values as chips
- Remove existing values
- Click a chip label to rename it

Text fields (CPU, RAM, Storage, Cellular Module, IP Rating, Power Input, OS, Dimensions, Weight, Housing, Operating Temp) are shown as free-text by default. A "Make dropdown" button converts any text field to a dropdown, at which point you manage its options in this panel. A "Revert to text" button converts it back.

Click "Save Field Options" to push the updated dropdown definitions to the Gist. They take effect immediately in the product form.

---

## 6. Data flow — how a publish reaches the live site

```
Admin: Save & Publish
        │
        ├─ 1. Upload new images/PDFs → GitHub API → assets/ in repo
        │
        ├─ 2. Serialise products to JSON (buildJsonData)
        │       includes: id, name, cat, desc, all spec fields,
        │                 images[], use_cases[], hidden_fields[],
        │                 additional_specs[], variants, part_datasheets,
        │                 datasheet
        │
        ├─ 3. Write products.json → GitHub Gist (primary live source)
        │
        ├─ 4. Commit data/products.json → GitHub repo (fallback)
        │
        └─ 5. Append activity log entry → Gist

Main site: page load
        │
        ├─ 1. Fetch Gist via GitHub API (cache: no-store) → parse JSON
        │       applyData() extracts images, use_cases, datasheets
        │       into their respective maps; products array becomes PRODUCTS
        │
        ├─ 2. If Gist fails → fetch data/products.json from repo
        │
        └─ 3. If both fail → use static PRODUCTS_DATA from products.js
```

---

## 7. Product schema reference

All fields are stored in the products array in the Gist JSON. The admin form serialises exactly these fields on Save & Publish.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique kebab-case key. Used as the lookup key in all asset maps. Never change after creation without updating all maps. |
| `name` | string | Display name on cards, modals, and compare table |
| `cat` | string | Must match one of the configured categories |
| `order` | number | Sort order within category (lower = first) |
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
| `ports` | number | Total Ethernet port count — drives the port count filter |
| `os` | string | Operating system; use `—` if not applicable |
| `housing` | string | Enclosure material, e.g. `Aluminium` |
| `dims` | string | Dimensions string, e.g. `140×90×30 mm`; use `—` if unknown |
| `weight` | string | Weight, e.g. `350 g`; use `—` if unknown |
| `op_temp` | string | Operating temperature range, e.g. `-20–60 °C`; use `—` if unknown |
| `images` | string[] | Array of asset paths, e.g. `["assets/images/product.png"]` |
| `use_cases` | string[] | Array of use-case label strings |
| `hidden_fields` | string[] | Field keys excluded from the detail modal, e.g. `["cpu","ram","storage"]` |
| `additional_specs` | object[] | Custom spec rows: `[{ "k": "HDMI", "v": "1 × HDMI 2.0" }, ...]` |
| `datasheet` | string \| null | Path to the product-level PDF, or `null` |
| `variants` | object \| null | Variants table config (see below), or `null` |
| `part_datasheets` | object | Map of part number → PDF path for per-variant datasheets |

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
  "note": "Optional note shown above the table in monospace (or null to omit)",
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
| Part number found in `part_datasheets` | **View** button (new tab) + **Download** button |
| Part number not in `part_datasheets` | **Contact us** link (pre-filled email to `sales@invendis.com`) |
| Product has a `datasheet` path | "Product Datasheet" section with View + Download buttons |
| No variants and no product datasheet | No datasheet section shown |
| Variants exist but no part has a datasheet | Data Sheet column is hidden from the variants table |

---

## 10. How to manage products (admin workflow)

### Add a new product

1. Open `admin/index.html` and sign in with your Microsoft account
2. Click **+ Add Product** in the sidebar
3. Fill in the Basic Info (ID must be unique, lowercase, no spaces)
4. Add use cases via the tag editor
5. Fill in specifications; toggle the eye icon to hide any field from the public modal
6. Add any custom fields with **+ Add Spec** (e.g. "HDMI: 1 × HDMI 2.0")
7. Upload product images via **+ Add Images**
8. Upload a product datasheet PDF if available via **Upload PDF**
9. Add variants via **+ Add Column / + Add Row** if the product has ordering variants
10. Click **Save & Publish** — changes go live immediately

### Edit an existing product

1. Select the product from the sidebar
2. Make your changes
3. Click **Save & Publish**

> **Important:** Always hard-refresh the admin page (`Ctrl + Shift + R`) after any code change to the admin panel before saving, to ensure the latest version of `buildJsonData()` is running. Using a cached version of the admin page may silently drop new fields from the saved JSON.

### Delete a product

1. Select the product from the sidebar
2. Click **Delete** in the form actions bar
3. Confirm the deletion — the product is removed from the Gist and the repo immediately

### Reorder products within a category

Set the **Sort Order** field on each product. Lower numbers appear first. Products with the same sort order appear in the order they were added.

---

## 11. How to manage categories

1. Go to the **Categories** tab in the admin panel
2. Add a new category name in the input at the bottom and click **Add**
3. Remove a category with the × button (note: products assigned to a deleted category are not automatically reassigned)
4. Click **Save & Publish** in the Categories tab to push changes live

**Developer note:** To add a colour for a new category badge, add a CSS class in `styles.css` following the `.b-router`, `.b-gateway` pattern, then add the class mapping in `catBadgeClass()` in `js/utils.js`.

---

## 12. How to manage field options (dropdowns)

1. Go to the **Field Options** tab in the admin panel
2. For each dropdown field (Wi-Fi, Cellular Gen, RS485, RS232):
   - Add a new option by typing in the add row input
   - Remove an option by clicking the × chip button
   - Rename an option by clicking its label and editing inline
3. For text fields (CPU, RAM, Storage, etc.):
   - Click **Make dropdown** to convert a text field to a dropdown and manage its values here
   - Click **Revert to text** to convert it back to a free-text input
4. Click **Save Field Options** — changes take effect in the product form immediately and are written to the Gist

---

## 13. Setup — first-time configuration

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
| `folderPath` | OneDrive folder name |
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

### Gist setup

The Gist is created automatically on the first Save & Publish. After the first save:
1. Copy the Gist ID from the Setup tab
2. Paste it into `gistId` in `onedrive-config.js`
3. Copy the raw URL and paste it into `productsJsonUrl` in `onedrive-config.js`
4. Commit and push `js/onedrive-config.js` to the repo

---

## 14. Local development

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

**Cache busting:** Script tags in `index.html` include a `?v=` query string (e.g. `?v=e4a71b3`). Bump this value whenever you want to force browsers to reload a script file after a code change.

---

## 15. Styling and layout guide

All styles are in `styles.css`. The file is not minified — search for the class names below to find the relevant section.

| What to change | Class / selector to search for |
|---|---|
| Page header | `.header`, `.header-inner`, `.header-left`, `.header-right` |
| Hero banner | `.hero`, `.hero-inner`, `.hero-stats` |
| Filter bar | `.filter-bar`, `.search-wrap` |
| Category tabs | `.cat-tabs`, `.cat-tab` |
| Grid layout | `.grid-view` — currently `repeat(4, minmax(0, 1fr))` on desktop |
| List view rows | `.list-view`, `.list-head`, `.list-row` |
| Product cards | `.card`, `.card-name`, `.card-desc`, `.card-specs`, `.card-use-cases`, `.card-footer` |
| Category badge colours | `.b-router`, `.b-gateway`, `.b-switch`, `.b-energy`, `.b-other`, `.b-pcb` |
| Spec pills on cards | `.spec-pill`, `.spec-pill.highlight`, `.spec-pill.warn` |
| Detail modal | `.modal`, `.modal-overlay`, `.modal-header`, `.modal-body` |
| Modal spec sections | `.spec-section`, `.spec-section-title`, `.spec-row` |
| Image carousel | `.product-image-wrap`, `.carousel-img`, `.carousel-btn` |
| Variants table | `.variants-table`, `.variants-table-wrap`, `.variants-section` |
| Datasheet buttons | `.ds-btn`, `.ds-view`, `.ds-download`, `.ds-contact` |
| Compare tray | `.compare-tray`, `.compare-tray-chips` |
| Compare modal | `.compare-modal`, `.compare-table` |
| Pagination | `.pagination`, `.pg-btn` |
| Footer | `.footer-inner`, `.footer-brand`, `.footer-contact`, `.footer-bottom` |

### Responsive breakpoints

| Breakpoint | Changes |
|---|---|
| `≤ 900px` (tablet) | Grid → 3 columns; modal becomes wider relative to viewport |
| `≤ 768px` | Filter bar stacks vertically; header contact links hidden |
| `≤ 480px` (mobile) | Grid → 2 columns; modal becomes full-width bottom sheet |

---

## 16. Adding or extending features (developer reference)

### Add a new filter

1. Add a `<select>` in `index.html` inside `.filter-bar`; call `currentPage=1;render()` on change
2. Add the filter logic in `getFiltered()` in `js/filters.js`
3. Add the element ID to `hasActiveFilters()` and reset it in `clearFilters()` in `js/filters.js`

### Add a new product field

1. Add the `<input>` or `<select>` to the edit form in `admin/index.html`
2. Add the field key to the `COLS` array in `admin/index.html` (or add an explicit line in `buildJsonData()` for array/object fields)
3. Populate the field in `populateForm()` in `admin/index.html`
4. Read the field in `saveProduct()` / `readForm()` in `admin/index.html`
5. Display it in the appropriate section of `openDetail()` in `js/modal.js`
6. Add it to the product schema reference in this README

### Add a new product category

1. Add the category name in the admin Categories tab → Save & Publish
2. Add a badge colour class in `styles.css` (e.g. `.b-newcat { background: ...; color: ...; }`)
3. Add the class mapping in `catBadgeClass()` in `js/utils.js`

### Add a new spec section to the detail modal

The modal body is built in `openDetail()` in `js/modal.js`. Add a new `<div class="spec-section">` block alongside the existing sections. Use `srow(label, value)` from `js/utils.js` to render each row. Use `isHf(p, 'field_key')` to respect hidden field toggles.

### Bump the script cache version

Change the `?v=` suffix on all `<script>` tags in `index.html` to a new short hash (any string) after a code change that you need browsers to pick up immediately. All scripts share the same version string for consistency.

### Recovery: Gist has bad data

Use the **Manual Sync** tool in the admin Setup tab. Click "Load & Compare" to see the diff between the repo file and the live Gist, then "Overwrite Gist with Repo Content" to restore from the last committed `data/products.json`.
