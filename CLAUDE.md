# Activate Solutions — Finance Tracker
## Claude Code Build Brief

This document gives Claude Code full context to build the Google Sheets-backed version of the Activate Solutions Finance Tracker — a mobile-first PWA for Tommy's handyman business in San Antonio, TX.

---

## Business Context

- **Business:** Activate Solutions — handyman/smart home services, San Antonio TX (78201, ~20-mile radius)
- **Owner:** Tommy
- **Platform:** Angi.com for lead gen; building early reviews with competitive pricing
- **Phone:** 210-296-9294
- **Brand color:** `#1A7FAA` (primary), `#155F8A` (dark), `#E6F4FA` (light)

---

## Project Goal

Replace `localStorage` in the existing single-file HTML app with **Google Sheets as the database**, using **Google Apps Script** as a free serverless API. The HTML file becomes a mobile PWA that reads/writes live to a Google Sheet.

---

## Current App — What Already Exists

The current working app is `activate_finance_tracker.html`. It is fully functional with localStorage. The task is to **migrate the data layer only** — all UI, wizard flow, and report logic stays the same.

### Screens
1. **PIN gate** — 4-digit PIN, default `1234`, stored in settings
2. **Home** — month-to-date metrics (income/expenses/net), quick action buttons, recent entries list
3. **Wizard** — step-by-step entry flow (income, expense, mileage)
4. **Success** — confirmation screen after save
5. **Reports** — P&L, expense breakdown, reimbursable, mileage log, Schedule C; filterable by period/customer/job
6. **History** — searchable full entry list, tap to view/edit/delete
7. **Settings** — PIN, default markup %, customers, jobs, categories, vendors, export CSV, clear data

---

## Data Model

### Entry object (one row per entry in Sheet)
```json
{
  "id": "1717000000000",         // Date.now() string — primary key
  "type": "income|expense|mileage",
  "date": "2026-05-15T14:30:00.000Z",  // ISO string
  "amount": 350.00,              // numeric, 0 for mileage
  "miles": 0,                    // numeric, 0 for non-mileage
  "category": "Materials",       // expense only
  "payMethod": "Cash|Check|Venmo|Cash App",  // income only
  "reimbursable": "No|Yes — at cost|Yes — with markup",
  "markupPct": 20,               // 0 if not reimbursable with markup
  "customer": "Linda Prudhomme", // or "No customer"
  "jobId": "1717000000001",      // FK → jobs table, or ""
  "description": "Replaced fence boards",
  "vendor": "Home Depot"         // expense only, or ""
}
```

### Customers — simple array of strings
```json
["Linda Prudhomme", "Alejandro Tapia"]
```

### Jobs — array of objects
```json
[
  {
    "id": "1717000000001",
    "name": "Master Bath Remodel",
    "location": "123 Main St, San Antonio",
    "customer": "Linda Prudhomme"
  }
]
```

### Categories — array of strings (user-extensible)
Default: `['Tools & Equipment','Fuel/Mileage','Materials','Insurance','Platform Fees (Angi)','Advertising','Subcontractors','Other']`

### Vendors — array of strings, sorted most-recent-first, capped at 50
```json
["Home Depot", "Lowe's", "Amazon", "Ace Hardware"]
```

### Settings object
```json
{
  "pin": "1234",
  "defaultMarkup": 20
}
```

---

## Constants
```js
const IRS_RATE = 0.70;          // 2026 IRS mileage rate $/mile
const PAYMENT_METHODS = ['Cash','Check','Venmo','Cash App'];
```

---

## Google Sheets Architecture

### Sheet structure — one workbook, six tabs

| Tab name | Purpose |
|----------|---------|
| `Entries` | One row per entry — all fields as columns |
| `Customers` | Column A: customer names |
| `Jobs` | Columns: id, name, location, customer |
| `Categories` | Column A: category names |
| `Vendors` | Column A: vendor names (ordered most-recent-first) |
| `Settings` | Key-value pairs: pin, defaultMarkup |

### Entries tab column order
`id | type | date | amount | miles | category | payMethod | customer | jobId | description | vendor | reimbursable | markupPct`

### Apps Script — required endpoints (single `doPost` + `doGet`)

The script handles all operations via a `action` parameter:

**GET actions** (called on app load):
- `action=getRecent&days=90` → returns `{ entries[], customers[], jobs[], categories[], vendors[], settings{}, hasOlder: bool }` — entries limited to past 90 days; `hasOlder: true` signals the app to show a "Load older entries" button
- `action=getOlderEntries&before=ISO_DATE` → returns `{ entries[] }` — all entries with date before the given ISO timestamp (used for on-demand history fetch)

**POST actions** (called on user interaction):
- `action=addEntry` + entry JSON → appends row to Entries tab, returns `{ ok: true, id }`
- `action=updateEntry` + entry JSON → finds row by id, updates in place, returns `{ ok: true }`
- `action=deleteEntry` + `{ id }` → deletes row by id, returns `{ ok: true }`
- `action=saveCustomers` + `{ customers[] }` → overwrites Customers tab
- `action=saveJobs` + `{ jobs[] }` → overwrites Jobs tab
- `action=saveCategories` + `{ categories[] }` → overwrites Categories tab
- `action=saveVendors` + `{ vendors[] }` → overwrites Vendors tab
- `action=saveSettings` + `{ settings{} }` → overwrites Settings tab

### CORS — Apps Script must include these headers
```js
return ContentService
  .createTextOutput(JSON.stringify(result))
  .setMimeType(ContentService.MimeType.JSON);
// Deploy as: Execute as Me, Anyone (even anonymous) can access
```

---

## HTML App — Data Layer Changes Required

Replace every `localStorage` call with an async call to the Apps Script URL. The URL is set as a constant at the top of the file:

```js
const SHEETS_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
```

### Key functions to rewrite

| Old (localStorage) | New (Sheets API) |
|--------------------|-----------------|
| `getData()` | `_entries` in-memory array (populated by `getRecent`) |
| `saveData(d)` | `async addEntry(entry)` / `updateEntry(entry)` / `deleteEntry(id)` |
| `getCustomers()` | `_customers` in-memory (loaded with `getRecent`) |
| `saveCustomers(c)` | `async saveCustomers(c)` → POST |
| `getJobs()` | `_jobs` in-memory (loaded with `getRecent`) |
| `saveJobs(j)` | `async saveJobs(j)` → POST |
| `getCategories()` | `_categories` in-memory (loaded with `getRecent`) |
| `saveCategories(c)` | `async saveCategories(c)` → POST |
| `getVendors()` | `_vendors` in-memory (loaded with `getRecent`) |
| `saveVendors(v)` | `async saveVendors(v)` → POST |
| `getSettings()` | `_settings` in-memory (loaded with `getRecent`) |
| `saveSettings(s)` | `async saveSettings(s)` → POST |
| *(new)* | `async loadOlderEntries()` → GET `getOlderEntries&before=date` |

### In-memory cache pattern
On app load (after PIN), call `getRecent?days=90` once and populate in-memory variables:
```js
let _entries = [];        // starts with past 90 days; grows if user loads older
let _hasOlderEntries = false;  // true when Sheet contains entries older than 90 days
let _oldestLoadedDate = null;  // tracks cutoff for next on-demand fetch
let _customers = [];
let _jobs = [];
let _categories = [...DEFAULT_CATS];
let _vendors = [];
let _settings = {};
```
All UI reads from these in-memory arrays (fast, no waiting). Writes go to Sheets in the background.

### On-demand older entries
In the History screen, when `_hasOlderEntries` is true, show a **"Load older entries"** button at the bottom of the list. Tapping it calls `getOlderEntries?before=_oldestLoadedDate`, prepends results to `_entries`, updates `_oldestLoadedDate`, and re-renders. Button hides when no more older entries exist.

### Optimistic UI pattern
When user saves an entry:
1. Immediately push to `_entries` and refresh the UI (instant feedback)
2. Fire `addEntry(entry)` to Sheets in background
3. On error: remove from `_entries`, show toast "Sync failed — will retry"

### Loading state
Show a branded loading screen after PIN entry while `getRecent` resolves. Spinner + "Loading your data…" message. Target < 2 seconds on LTE. The 90-day window keeps this fast even as the dataset grows over years.

### Offline detection
```js
if (!navigator.onLine) {
  showToast('You\'re offline. Entry saved locally — will sync when reconnected.');
  // queue to localStorage as fallback, sync on 'online' event
}
```

---

## Offline Queue (Answer to pre-build question C)

Queue entries locally when offline, sync when reconnected:

```js
// On save when offline:
const queue = JSON.parse(localStorage.getItem('as_sync_queue') || '[]');
queue.push({ action: 'addEntry', payload: entry });
localStorage.setItem('as_sync_queue', JSON.stringify(queue));

// On navigator 'online' event:
window.addEventListener('online', flushSyncQueue);
async function flushSyncQueue() {
  const queue = JSON.parse(localStorage.getItem('as_sync_queue') || '[]');
  for (const item of queue) {
    await post(item.action, item.payload);
  }
  localStorage.removeItem('as_sync_queue');
}
```

---

## PWA Setup

Add to `<head>` for Add to Home Screen support:
```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="AS Finance">
<link rel="manifest" href="manifest.json">
```

`manifest.json`:
```json
{
  "name": "Activate Solutions Finance",
  "short_name": "AS Finance",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1A7FAA",
  "theme_color": "#1A7FAA",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## Build Order for Claude Code

1. **Write `apps-script.gs`** — the full Google Apps Script with all actions
2. **Write setup instructions** — step-by-step for Tommy to deploy the script and get the URL
3. **Update `activate_finance_tracker.html`** — replace data layer, add loading screen, add offline queue, add PWA meta tags
4. **Write `manifest.json`**
5. **Generate `icon-192.png` and `icon-512.png`** — simple branded icons using canvas or SVG-to-PNG

---

## Questions Answered (Pre-build decisions)

- **A. Data load on startup:** Load the **past 90 days** only on initial load. Older entries are fetched on demand via a "Load older entries" button in the History screen. This keeps startup fast regardless of how many total entries exist.
- **B. Google account:** `tmcnish@activatemysolution.com` — the Apps Script must be deployed from this account and the Sheet must live in this account's Google Drive.
- **C. Offline behavior:** Queue locally, sync on reconnect (see Offline Queue section above).

---

## File Structure for Claude Code Project

```
activate-solutions-finance/
├── CLAUDE.md                          ← this file
├── activate_finance_tracker.html      ← main app (update data layer)
├── apps-script.gs                     ← Google Apps Script source
├── manifest.json                      ← PWA manifest
├── icon-192.png                       ← PWA icon
├── icon-512.png                       ← PWA icon
└── SETUP.md                           ← step-by-step deployment guide for Tommy
```

---

## Design Tokens (do not change these)

```css
--brand: #1A7FAA;
--brand-dark: #155F8A;
--brand-light: #E6F4FA;
--brand-mid: #B8DFF0;
--success: #1D9E75;
--success-bg: #E1F5EE;
--danger: #D84040;
--danger-bg: #FCEBEB;
--warn: #BA7517;
--warn-bg: #FAEEDA;
--font: 'DM Sans', sans-serif;
--mono: 'DM Mono', monospace;
```

---

## Existing Code Reference

The full working localStorage version is in `activate_finance_tracker.html` in this project. Use it as the UI source of truth — do not redesign anything, only migrate the data layer.

---

## ⚠️ IMPORTANT — Read This First

The `activate_finance_tracker.html` file in this project directory is **an older snapshot** and does not reflect the current live app. The live app is more advanced and already includes a **Quotes screen, quote wizard, and quote data model** that Tommy uses actively. 

**Before making any changes, Claude Code must read the actual current file and verify what already exists.** Do not assume the screen list or data model above is complete — it was written before the quotes feature was built.

---

## New Feature Requests — Gathered 2026-06-13

The following three feature areas were scoped in a planning conversation. The quote data model was fully designed. Claude Code should read the live app first, confirm what exists, then implement only what's missing.

---

### Feature 1 — Edit finalized quotes (request #1)

Tommy wants the ability to edit a quote after it has been finalized/saved. This may already be partially implemented — **verify before building.**

---

### Feature 2 — GPS functionality (request #2)

Two sub-features, both net-new as of the planning session:

**2a. Auto mileage tracking**
- Use `navigator.geolocation.watchPosition()` to track miles driven while the app is open
- Accumulate a daily mileage total stored locally
- When a quote is marked **Completed**, prompt: "You drove X miles today — apply to this job?"
- If yes, auto-create a mileage entry linked to that job

**2b. Geofence arrival notifications**
- When Tommy arrives near a job location, send a push notification reminding him to log job and quote details
- Requires: job `location` field geocoded to lat/lng (currently stored as plain text)
- Requires: `Notification` API permission + Service Worker for background delivery
- Requires: a geocoding API call (Google Maps Geocoding or similar) to convert address → coordinates
- Geofence radius: TBD — reasonable default ~200 meters

**Build order for GPS:** 2a before 2b. 2b depends on geocoding infrastructure that doesn't exist yet.

---

### Feature 3 — Generate receipts from completed jobs (request #3)

When a job is marked Completed, allow Tommy to generate a work receipt pre-filled from the quote line items and send it to the customer.

**Context:** A fillable PDF receipt template already exists (`Activate_Solutions_Receipt_Fillable.pdf`, built with ReportLab in Python). That is server-side — in-app receipt generation needs a JS approach.

**Approach for in-app:** Use browser `window.print()` with a receipt-formatted print stylesheet that matches the existing PDF branding. No external dependencies.

**Receipt contents (pre-filled from quote):**
- Customer name, job location
- Line items (description, qty, unit, unit price, amount)
- Labor subtotal, materials subtotal
- Tax (optional), discount (optional), total
- Payment method (from Paid transition)
- 30-day warranty statement (static, same text as existing PDF receipt)
- Activate Solutions branding: phone 210-296-9294, brand color #1A7FAA

**Trigger:** "Generate receipt" button on any quote with status `completed` or `paid`.

---

### Quote Data Model — Fully Locked

This was designed from scratch in the planning session. **If the live app already has a quote model, compare carefully and reconcile — do not overwrite existing data.**

```js
{
  // Identity
  id: "1717000000000",           // Date.now() string, primary key
  quoteNumber: "Q-2026-001",     // auto-incremented, year-scoped
  version: 1,                    // increments on revision
  parentId: null,                // null for originals; original id on revisions
  status: "draft",               // see lifecycle below

  // Linkage
  customer: "Linda Prudhomme",   // matches customers[]
  jobId: "1717000000001",        // FK → jobs[], or ""

  // Dates
  createdAt: "2026-05-15T14:30:00.000Z",
  updatedAt: "2026-05-15T14:30:00.000Z",
  completedAt: null,
  paidAt: null,

  // Line items
  lineItems: [
    {
      id: "li_001",
      description: "Labor — fence repair",
      qty: 1,
      unit: "job",              // job | hr | day | flat | sqft | lnft | ea
      unitPrice: 225.00,
      type: "labor",            // labor | material | other
      amount: 225.00            // qty × unitPrice, computed
    }
  ],

  // Totals (computed on save)
  laborTotal: 225.00,
  materialsTotal: 37.00,
  subtotal: 262.00,
  tax: 0,                       // optional, dollar amount
  discount: 0,                  // optional, dollar amount
  total: 262.00,                // subtotal + tax - discount

  // Optionals
  notes: "",
  mileageApplied: 0,            // miles logged on completion
  receiptGenerated: false,

  // Payment (filled on Paid transition)
  paymentMethod: "",
  linkedIncomeId: ""            // id of auto-created income entry
}
```

### Quote status lifecycle

```
draft → sent → approved → in_progress → completed → paid
                                              ↓
                                   triggers receipt + mileage prompt
                                   triggers auto income entry creation

At any point before paid:
  → declined
  → cancelled

Terminal statuses (no further transitions):
  paid, superseded

Reopenable (creates fresh draft):
  declined → draft
  cancelled → draft
```

### Status transition rules

| From | Allowed next |
|------|-------------|
| `draft` | sent, approved, in_progress, declined, cancelled |
| `sent` | approved, declined, cancelled |
| `approved` | in_progress, declined, cancelled |
| `in_progress` | completed, cancelled |
| `completed` | paid, cancelled |
| `paid` | *(terminal)* |
| `superseded` | *(terminal, read-only)* |
| `declined` | draft (reopen) |
| `cancelled` | draft (reopen) |

### Status display colors

| Status | Color |
|--------|-------|
| `draft` | Gray (`--text3`) |
| `sent` | Warn yellow (`--warn`) |
| `approved` | Brand light (`--brand`) |
| `in_progress` | Brand (`--brand`) |
| `completed` | Purple (`#7B4FB5`) |
| `paid` | Success green (`--success`) |
| `superseded` | Muted gray |
| `declined` | Danger red (`--danger`) |
| `cancelled` | Danger red (`--danger`) |

### Revision rules

- Allowed from: `draft`, `sent`, `approved`
- Not allowed from: `in_progress`, `completed`, `paid`
- On revision: old quote → `superseded` (locked), new quote → `draft` with `version + 1`, line items pre-filled, same `quoteNumber`, `parentId` = original id

### Auto income entry on Paid transition

Triggered on `completed → paid`:
- Prompt for payment method (Cash / Check / Venmo / Cash App)
- Auto-create income entry:
  - `amount` = `quote.total`
  - `customer` = `quote.customer`
  - `jobId` = `quote.jobId`
  - `payMethod` = captured at Paid transition
  - `description` = `"Payment for " + quote.quoteNumber`
  - `quoteId` = `quote.id` *(new field on income entries)*
- Set `quote.linkedIncomeId` = new income entry id

### Storage

| Key | Contents |
|-----|---------|
| `as_quotes` | `quote[]` — all quotes including superseded |
| `as_settings.quoteCounter` | integer, increments per new quote, resets yearly |

### Income entry — new field

All income entries get a new optional field:
```js
quoteId: ""   // populated when auto-created from a quote, else ""
```

### Unit options for line items

`job` · `hr` · `day` · `flat` · `sqft` · `lnft` · `ea`

---

### Recommended build order for Claude Code

1. **Read the live app** — identify what quote functionality already exists, reconcile with spec above
2. **Feature 1** — add/fix edit capability for finalized quotes if not already present
3. **Feature 3** — receipt generation (no permission dependencies, high value)
4. **Feature 2a** — GPS auto mileage tracking
5. **Feature 2b** — geofence arrival notifications (most complex, last)

