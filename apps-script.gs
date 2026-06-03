// Activate Solutions Finance Tracker — Google Apps Script backend
// Deploy as: Execute as Me, Anyone (even anonymous) can access
// Account: tmcnish@activateyoursolution.com

// ─── Sheet name constants ────────────────────────────────────────────────────
var SHEET_ENTRIES    = 'Entries';
var SHEET_CUSTOMERS  = 'Customers';
var SHEET_JOBS       = 'Jobs';
var SHEET_CATEGORIES = 'Categories';
var SHEET_VENDORS    = 'Vendors';
var SHEET_SETTINGS   = 'Settings';
var SHEET_QUOTES     = 'Quotes';
var SHEET_PRICE_GUIDE = 'PriceGuide';

// Quotes tab column order (1-based)
var QCOL = {
  id: 1, status: 2, customer: 3, jobId: 4, title: 5,
  date: 6, notes: 7, completedDate: 8, totalAmount: 9,
  amountPaid: 10, lineItemsJSON: 11, paymentsJSON: 12
};
var QUOTES_COL_COUNT = 12;

// PriceGuide tab column order (1-based)
var PGCOL = { id: 1, name: 2, minPrice: 3, maxPrice: 4, unit: 5 };
var PG_COL_COUNT = 5;

// Entries tab column order (1-based index)
var COL = {
  id:           1,
  type:         2,
  date:         3,
  amount:       4,
  miles:        5,
  category:     6,
  payMethod:    7,
  customer:     8,
  jobId:        9,
  description:  10,
  vendor:       11,
  reimbursable: 12,
  markupPct:    13
};
var ENTRY_COL_COUNT = 13;

// ─── CORS helper ─────────────────────────────────────────────────────────────
function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function respondError(msg) {
  return respond({ ok: false, error: msg });
}

// ─── Spreadsheet helpers ─────────────────────────────────────────────────────
function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function ensureHeaders() {
  var entriesSheet = getSheet(SHEET_ENTRIES);
  if (entriesSheet.getLastRow() === 0) {
    entriesSheet.appendRow([
      'id','type','date','amount','miles','category',
      'payMethod','customer','jobId','description','vendor',
      'reimbursable','markupPct'
    ]);
  }
}

// ─── Entry row conversion ─────────────────────────────────────────────────────
function rowToEntry(row) {
  return {
    id:           String(row[COL.id - 1] || ''),
    type:         String(row[COL.type - 1] || ''),
    date:         String(row[COL.date - 1] || ''),
    amount:       parseFloat(row[COL.amount - 1]) || 0,
    miles:        parseFloat(row[COL.miles - 1]) || 0,
    category:     String(row[COL.category - 1] || ''),
    payMethod:    String(row[COL.payMethod - 1] || ''),
    customer:     String(row[COL.customer - 1] || ''),
    jobId:        String(row[COL.jobId - 1] || ''),
    description:  String(row[COL.description - 1] || ''),
    vendor:       String(row[COL.vendor - 1] || ''),
    reimbursable: String(row[COL.reimbursable - 1] || 'No'),
    markupPct:    parseFloat(row[COL.markupPct - 1]) || 0
  };
}

function entryToRow(e) {
  return [
    e.id, e.type, e.date, e.amount, e.miles, e.category,
    e.payMethod, e.customer, e.jobId, e.description, e.vendor,
    e.reimbursable, e.markupPct
  ];
}

// ─── Quote row conversion ─────────────────────────────────────────────────────
function safeParseJSON(val, fallback) {
  try { return JSON.parse(val) || fallback; } catch(e) { return fallback; }
}

function rowToQuote(row) {
  return {
    id:            String(row[0] || ''),
    status:        String(row[1] || 'draft'),
    customer:      String(row[2] || ''),
    jobId:         String(row[3] || ''),
    title:         String(row[4] || ''),
    date:          String(row[5] || ''),
    notes:         String(row[6] || ''),
    completedDate: String(row[7] || ''),
    totalAmount:   parseFloat(row[8]) || 0,
    amountPaid:    parseFloat(row[9]) || 0,
    lineItems:     safeParseJSON(row[10], []),
    payments:      safeParseJSON(row[11], [])
  };
}

function quoteToRow(q) {
  return [
    q.id, q.status, q.customer, q.jobId || '', q.title,
    q.date, q.notes || '', q.completedDate || '',
    q.totalAmount || 0, q.amountPaid || 0,
    JSON.stringify(q.lineItems || []),
    JSON.stringify(q.payments || [])
  ];
}

// ─── Find entry row index by id (returns 1-based row number, -1 if not found) ─
function findEntryRow(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, COL.id, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function findQuoteRow(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return -1;
  var ids = sheet.getRange(1, QCOL.id, lastRow, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

// ─── GET handler ─────────────────────────────────────────────────────────────
function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  var action = params.action || '';

  try {
    if (action === 'getRecent')       return handleGetRecent(params);
    if (action === 'getOlderEntries') return handleGetOlderEntries(params);
    if (action === 'getQuotes')       return handleGetQuotes(params);
    return respondError('Unknown GET action: ' + action);
  } catch (err) {
    return respondError(err.toString());
  }
}

function handleGetRecent(params) {
  var days = parseInt(params.days, 10) || 90;
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  var cutoffISO = cutoff.toISOString();

  var entriesSheet = getSheet(SHEET_ENTRIES);
  var lastRow = entriesSheet.getLastRow();

  var recentEntries = [];
  var hasOlder = false;

  if (lastRow >= 2) {
    var data = entriesSheet.getRange(2, 1, lastRow - 1, ENTRY_COL_COUNT).getValues();
    for (var i = 0; i < data.length; i++) {
      var dateVal = String(data[i][COL.date - 1] || '');
      if (!dateVal) continue;
      if (dateVal >= cutoffISO) {
        recentEntries.push(rowToEntry(data[i]));
      } else {
        hasOlder = true;
      }
    }
  }

  // Sort most-recent first
  recentEntries.sort(function(a, b) { return b.date.localeCompare(a.date); });

  return respond({
    ok: true,
    entries:    recentEntries,
    customers:  getColumnValues(SHEET_CUSTOMERS),
    jobs:       getJobs(),
    categories: getColumnValues(SHEET_CATEGORIES),
    vendors:    getColumnValues(SHEET_VENDORS),
    settings:   getSettingsObj(),
    priceGuide: getPriceGuideItems(),
    hasOlder:   hasOlder
  });
}

function handleGetOlderEntries(params) {
  var before = params.before || '';
  if (!before) return respondError('before parameter required');

  var entriesSheet = getSheet(SHEET_ENTRIES);
  var lastRow = entriesSheet.getLastRow();
  var olderEntries = [];

  if (lastRow >= 2) {
    var data = entriesSheet.getRange(2, 1, lastRow - 1, ENTRY_COL_COUNT).getValues();
    for (var i = 0; i < data.length; i++) {
      var dateVal = String(data[i][COL.date - 1] || '');
      if (dateVal && dateVal < before) {
        olderEntries.push(rowToEntry(data[i]));
      }
    }
  }

  olderEntries.sort(function(a, b) { return b.date.localeCompare(a.date); });

  return respond({ ok: true, entries: olderEntries });
}

// ─── POST handler ─────────────────────────────────────────────────────────────
function doPost(e) {
  var params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    // Fall back to form params
    params = e && e.parameter ? e.parameter : {};
  }

  var action = params.action || '';

  try {
    ensureHeaders();
    switch (action) {
      case 'addEntry':       return handleAddEntry(params);
      case 'updateEntry':    return handleUpdateEntry(params);
      case 'deleteEntry':    return handleDeleteEntry(params);
      case 'saveCustomers':  return handleSaveList(SHEET_CUSTOMERS, params.customers);
      case 'saveJobs':       return handleSaveJobs(params.jobs);
      case 'saveCategories': return handleSaveList(SHEET_CATEGORIES, params.categories);
      case 'saveVendors':    return handleSaveList(SHEET_VENDORS, params.vendors);
      case 'saveSettings':   return handleSaveSettings(params.settings);
      case 'addQuote':       return handleAddQuote(params);
      case 'updateQuote':    return handleUpdateQuote(params);
      case 'deleteQuote':    return handleDeleteQuote(params);
      case 'savePriceGuide': return handleSavePriceGuide(params);
      default:               return respondError('Unknown POST action: ' + action);
    }
  } catch (err) {
    return respondError(err.toString());
  }
}

function handleAddEntry(params) {
  var entry = params.entry || params;
  // Remove action key if it slipped in
  if (entry.action) delete entry.action;

  var sheet = getSheet(SHEET_ENTRIES);
  sheet.appendRow(entryToRow(entry));
  return respond({ ok: true, id: entry.id });
}

function handleUpdateEntry(params) {
  var entry = params.entry || params;
  if (entry.action) delete entry.action;

  var sheet = getSheet(SHEET_ENTRIES);
  var rowNum = findEntryRow(sheet, entry.id);
  if (rowNum === -1) return respondError('Entry not found: ' + entry.id);

  sheet.getRange(rowNum, 1, 1, ENTRY_COL_COUNT).setValues([entryToRow(entry)]);
  return respond({ ok: true });
}

function handleDeleteEntry(params) {
  var id = params.id;
  var sheet = getSheet(SHEET_ENTRIES);
  var rowNum = findEntryRow(sheet, id);
  if (rowNum === -1) return respondError('Entry not found: ' + id);

  sheet.deleteRow(rowNum);
  return respond({ ok: true });
}

// Overwrites a single-column sheet (Customers, Categories, Vendors)
function handleSaveList(sheetName, items) {
  if (!Array.isArray(items)) return respondError('items must be an array');
  var sheet = getSheet(sheetName);
  sheet.clearContents();
  if (items.length > 0) {
    var rows = items.map(function(v) { return [v]; });
    sheet.getRange(1, 1, rows.length, 1).setValues(rows);
  }
  return respond({ ok: true });
}

function handleSaveJobs(jobs) {
  if (!Array.isArray(jobs)) return respondError('jobs must be an array');
  var sheet = getSheet(SHEET_JOBS);
  sheet.clearContents();
  if (jobs.length > 0) {
    var rows = jobs.map(function(j) { return [j.id, j.name, j.location, j.customer]; });
    sheet.getRange(1, 1, rows.length, 4).setValues(rows);
  }
  return respond({ ok: true });
}

function handleSaveSettings(settings) {
  if (!settings) return respondError('settings required');
  var sheet = getSheet(SHEET_SETTINGS);
  sheet.clearContents();
  sheet.getRange(1, 1, 2, 2).setValues([
    ['pin',           settings.pin || '1234'],
    ['defaultMarkup', settings.defaultMarkup !== undefined ? settings.defaultMarkup : 20]
  ]);
  return respond({ ok: true });
}

// ─── Read helpers ─────────────────────────────────────────────────────────────
function getColumnValues(sheetName) {
  var sheet = getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) return [];
  var values = sheet.getRange(1, 1, lastRow, 1).getValues();
  return values.map(function(r) { return String(r[0]); }).filter(function(v) { return v !== ''; });
}

function getJobs() {
  var sheet = getSheet(SHEET_JOBS);
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) return [];
  var data = sheet.getRange(1, 1, lastRow, 4).getValues();
  return data
    .filter(function(r) { return r[0] !== ''; })
    .map(function(r) {
      return { id: String(r[0]), name: String(r[1]), location: String(r[2]), customer: String(r[3]) };
    });
}

function getSettingsObj() {
  var sheet = getSheet(SHEET_SETTINGS);
  var lastRow = sheet.getLastRow();
  var settings = { pin: '1234', defaultMarkup: 20 };
  if (lastRow === 0) return settings;
  var data = sheet.getRange(1, 1, lastRow, 2).getValues();
  data.forEach(function(row) {
    var key = String(row[0]);
    var val = row[1];
    if (key === 'pin') settings.pin = String(val);
    if (key === 'defaultMarkup') settings.defaultMarkup = parseFloat(val) || 20;
  });
  return settings;
}

// ─── Quotes handlers ──────────────────────────────────────────────────────────
function handleGetQuotes() {
  var sheet = getSheet(SHEET_QUOTES);
  var lastRow = sheet.getLastRow();
  var quotes = [];
  if (lastRow >= 1) {
    var data = sheet.getRange(1, 1, lastRow, QUOTES_COL_COUNT).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0])) quotes.push(rowToQuote(data[i]));
    }
  }
  return respond({ ok: true, quotes: quotes, priceGuide: getPriceGuideItems() });
}

function handleAddQuote(params) {
  var quote = params.quote || params;
  if (quote.action) delete quote.action;
  var sheet = getSheet(SHEET_QUOTES);
  sheet.appendRow(quoteToRow(quote));
  return respond({ ok: true, id: quote.id });
}

function handleUpdateQuote(params) {
  var quote = params.quote || params;
  if (quote.action) delete quote.action;
  var sheet = getSheet(SHEET_QUOTES);
  var rowNum = findQuoteRow(sheet, quote.id);
  if (rowNum === -1) return respondError('Quote not found: ' + quote.id);
  sheet.getRange(rowNum, 1, 1, QUOTES_COL_COUNT).setValues([quoteToRow(quote)]);
  return respond({ ok: true });
}

function handleDeleteQuote(params) {
  var id = params.id;
  var sheet = getSheet(SHEET_QUOTES);
  var rowNum = findQuoteRow(sheet, id);
  if (rowNum === -1) return respondError('Quote not found: ' + id);
  sheet.deleteRow(rowNum);
  return respond({ ok: true });
}

function handleSavePriceGuide(params) {
  var items = params.priceGuide;
  if (!Array.isArray(items)) return respondError('priceGuide must be an array');
  var sheet = getSheet(SHEET_PRICE_GUIDE);
  sheet.clearContents();
  if (items.length > 0) {
    var rows = items.map(function(item) {
      return [item.id, item.name, item.minPrice, item.maxPrice, item.unit];
    });
    sheet.getRange(1, 1, rows.length, PG_COL_COUNT).setValues(rows);
  }
  return respond({ ok: true });
}

// ─── Price guide read helper ──────────────────────────────────────────────────
function getPriceGuideItems() {
  var sheet = getSheet(SHEET_PRICE_GUIDE);
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) return [];
  var data = sheet.getRange(1, 1, lastRow, PG_COL_COUNT).getValues();
  return data
    .filter(function(r) { return r[0] !== ''; })
    .map(function(r) {
      return {
        id:       String(r[0]),
        name:     String(r[1]),
        minPrice: parseFloat(r[2]) || 0,
        maxPrice: parseFloat(r[3]) || 0,
        unit:     String(r[4] || 'flat')
      };
    });
}

// ─── One-time setup function — run manually once from the script editor ────────
// Open Tools > Run function > setupSpreadsheet to create all tabs with headers.
function setupSpreadsheet() {
  ensureHeaders();

  var customersSheet = getSheet(SHEET_CUSTOMERS);
  if (customersSheet.getLastRow() === 0) {
    customersSheet.appendRow(['No customer']);
  }

  getSheet(SHEET_JOBS);   // just ensure it exists

  var catSheet = getSheet(SHEET_CATEGORIES);
  if (catSheet.getLastRow() === 0) {
    var defaultCats = [
      'Tools & Equipment','Fuel/Mileage','Materials','Insurance',
      'Platform Fees (Angi)','Advertising','Subcontractors','Other'
    ];
    catSheet.getRange(1, 1, defaultCats.length, 1)
      .setValues(defaultCats.map(function(c) { return [c]; }));
  }

  getSheet(SHEET_VENDORS);  // just ensure it exists

  var settingsSheet = getSheet(SHEET_SETTINGS);
  if (settingsSheet.getLastRow() === 0) {
    settingsSheet.getRange(1, 1, 2, 2).setValues([
      ['pin', '1234'],
      ['defaultMarkup', 20]
    ]);
  }

  getSheet(SHEET_QUOTES);  // just ensure it exists

  var pgSheet = getSheet(SHEET_PRICE_GUIDE);
  if (pgSheet.getLastRow() === 0) {
    var defaultGuide = [
      ['pg1',  'General Handyman (hourly)',          65,  95,  'per hour'],
      ['pg2',  'Trip / Service Call Fee',            50,  75,  'flat'],
      ['pg3',  'Emergency / After-Hours Premium',    50,  100, 'flat'],
      ['pg4',  'Door Install (interior)',            100, 175, 'per door'],
      ['pg5',  'Door Install (exterior)',            175, 300, 'per door'],
      ['pg6',  'Door Lock / Deadbolt Install',        50,  90, 'per door'],
      ['pg7',  'Door Weatherstripping',               40,  75, 'per door'],
      ['pg8',  'Window Screen Repair / Replace',      35,  65, 'per window'],
      ['pg9',  'Window Caulking',                     20,  40, 'per window'],
      ['pg10', 'Drywall Patch (small, <6")',           75, 125, 'flat'],
      ['pg11', 'Drywall Patch (large, >6")',          150, 300, 'flat'],
      ['pg12', 'Drywall Texture Matching',             75, 150, 'flat'],
      ['pg13', 'Interior Painting (per room)',        200, 450, 'per room'],
      ['pg14', 'Interior Paint Touch-Up',              75, 150, 'flat'],
      ['pg15', 'Exterior Trim Painting',              150, 350, 'flat'],
      ['pg16', 'Cabinet Painting (kitchen)',          400, 800, 'flat'],
      ['pg17', 'Faucet Install / Replace',            100, 175, 'per fixture'],
      ['pg18', 'Toilet Repair (flapper/valve)',        75, 125, 'per fixture'],
      ['pg19', 'Toilet Install',                      150, 250, 'per fixture'],
      ['pg20', 'Garbage Disposal Install',            125, 200, 'flat'],
      ['pg21', 'Under-Sink Shutoff Valve Replace',     75, 125, 'per fixture'],
      ['pg22', 'Caulking (tub/shower/sink)',            60, 120, 'flat'],
      ['pg23', 'Outlet / Switch Replace',              50,  85, 'per outlet'],
      ['pg24', 'Ceiling Fan Install',                 100, 200, 'per fixture'],
      ['pg25', 'Light Fixture Install',                75, 150, 'per fixture'],
      ['pg26', 'GFCI Outlet Install',                  60, 100, 'per outlet'],
      ['pg27', 'Smoke / CO Detector Install',          35,  65, 'per fixture'],
      ['pg28', 'LVP / Laminate Install',                2,   4, 'per sq ft'],
      ['pg29', 'Tile Install (floor)',                   5,  10, 'per sq ft'],
      ['pg30', 'Grout Repair / Regrouting',             75, 200, 'flat'],
      ['pg31', 'Carpet Repair / Patch',                 75, 175, 'flat'],
      ['pg32', 'Hardwood Floor Repair',                100, 250, 'flat'],
      ['pg33', 'Furniture Assembly (simple)',           50, 100, 'flat'],
      ['pg34', 'Furniture Assembly (complex)',         100, 200, 'flat'],
      ['pg35', 'TV Wall Mount Install',                 75, 150, 'flat'],
      ['pg36', 'Fence Board Replace',                   25,  50, 'per board'],
      ['pg37', 'Fence Post Reset',                      75, 150, 'per post'],
      ['pg38', 'Gutter Cleaning',                      100, 200, 'flat'],
      ['pg39', 'Pressure Washing (per hour)',           75, 100, 'per hour'],
      ['pg40', 'Caulking / Sealant',                     2,   4, 'per linear ft']
    ];
    pgSheet.getRange(1, 1, defaultGuide.length, PG_COL_COUNT).setValues(defaultGuide);
  }

  SpreadsheetApp.getUi().alert('Setup complete! All tabs created.');
}
