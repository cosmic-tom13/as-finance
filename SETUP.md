# Activate Solutions Finance Tracker — Deployment Guide

Follow these steps to connect the app to Google Sheets. This takes about 15 minutes.

---

## Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and sign in as **tmcnish@activateyoursolution.com**
2. Click **Blank** to create a new spreadsheet
3. Name it: **Activate Solutions Finance**
4. Leave the tab open — you'll come back to it

---

## Step 2 — Open the Apps Script editor

1. In your new spreadsheet, click **Extensions** in the top menu
2. Click **Apps Script**
3. A new browser tab opens with a code editor

---

## Step 3 — Paste the script

1. Delete everything in the editor (Ctrl+A, then Delete)
2. Open the file `apps-script.gs` from this project folder
3. Copy the entire contents and paste it into the editor
4. Click the **Save** button (floppy disk icon) or press Ctrl+S
5. Name the project: **AS Finance Tracker** → click **OK**

---

## Step 4 — Run first-time setup

1. In the toolbar, click the function dropdown (it may say `myFunction` or `doGet`)
2. Select **setupSpreadsheet** from the dropdown
3. Click the **Run** button (▶ play icon)
4. A popup will ask you to authorize the script — click **Review permissions**
5. Sign in with **tmcnish@activateyoursolution.com** if prompted
6. On the "Google hasn't verified this app" screen, click **Advanced** → **Go to AS Finance Tracker (unsafe)**
7. Click **Allow**
8. After it runs, you should see an alert: **"Setup complete! All tabs created."**
9. Click **OK**

Switch back to your spreadsheet tab — you should now see 6 tabs at the bottom:
`Entries`, `Customers`, `Jobs`, `Categories`, `Vendors`, `Settings`

---

## Step 5 — Deploy as a web app

1. Back in the Apps Script editor, click **Deploy** (top right) → **New deployment**
2. Click the gear icon ⚙ next to "Select type" → choose **Web app**
3. Fill in the settings:
   - **Description:** AS Finance Tracker v1
   - **Execute as:** Me (tmcnish@activateyoursolution.com)
   - **Who has access:** Anyone
4. Click **Deploy**
5. Another authorization popup may appear — approve it (same steps as Step 4)
6. Copy the **Web app URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```
   **Save this URL — you'll need it in the next step.**

---

## Step 6 — Add the URL to the HTML app

1. Open `activate_finance_tracker.html` in a text editor (Notepad, VS Code, etc.)
2. Find this line near the top of the file:
   ```js
   const SHEETS_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
   ```
3. Replace `YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with the URL you copied in Step 5
4. Save the file

---

## Step 7 — Host the HTML file

The app is a single HTML file. You have several free options:

### Option A — GitHub Pages (recommended, free)
1. Create a free account at [github.com](https://github.com) if you don't have one
2. Create a new repository named `as-finance`
3. Upload `activate_finance_tracker.html`, `manifest.json`, `icon-192.png`, `icon-512.png`
4. Go to **Settings** → **Pages** → Source: **main branch** → **/ (root)**
5. Your app URL will be: `https://yourusername.github.io/as-finance/activate_finance_tracker.html`

### Option B — Netlify Drop (fastest, free)
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag and drop the project folder onto the page
3. Netlify gives you an instant URL

### Option C — Run locally (offline/testing only)
Open `activate_finance_tracker.html` directly in Chrome on your phone or computer.
Note: the file:// protocol may block some PWA features.

---

## Step 8 — Add to your iPhone home screen (PWA)

1. Open the app URL in **Safari** on your iPhone
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **Add to Home Screen**
4. Name it **AS Finance** → tap **Add**

The app icon now appears on your home screen and opens full-screen like a native app.

---

## Step 9 — Test it

1. Open the app and enter PIN: **1234**
2. Tap **+ Add Entry** and enter a test income entry
3. Go back to your Google Sheet — check the **Entries** tab for the new row
4. Try the Reports screen to confirm data loads

---

## Updating the script later

If you need to update `apps-script.gs`:
1. Open the Apps Script editor (Extensions → Apps Script in your Sheet)
2. Paste the updated code
3. Click **Deploy** → **Manage deployments**
4. Click the pencil ✏ icon on your existing deployment
5. Change **Version** to **New version**
6. Click **Deploy**

The URL stays the same — no need to update the HTML file.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Sync failed" toast in app | Check that the SHEETS_URL in the HTML is correct and the deployment is "Anyone" access |
| Blank app after PIN | Open browser DevTools (F12) → Console tab for error messages |
| "Script function not found" | Make sure you saved the script before deploying |
| Data not showing in Sheet | Confirm the Sheet is owned by tmcnish@activateyoursolution.com |
| Authorization error | Re-run setupSpreadsheet and re-approve permissions |

---

## Support

For help: call or text Tommy at **210-296-9294**
