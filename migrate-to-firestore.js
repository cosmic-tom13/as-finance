/**
 * migrate-to-firestore.js
 *
 * One-time migration: pulls all data from Google Apps Script and writes it
 * to Firestore using the Firebase Admin SDK.
 *
 * Usage:
 *   node migrate-to-firestore.js <serviceAccountPath>
 *
 * Example:
 *   node migrate-to-firestore.js ./serviceAccount.json
 *
 * Before running:
 *   1. npm install firebase-admin node-fetch
 *   2. Download service account key from Firebase Console →
 *      Project Settings → Service accounts → Generate new private key
 *   3. Run exportAllDataToJSON() in Apps Script editor to confirm the
 *      getAllData endpoint is deployed (redeploy Apps Script first)
 */

const admin = require('firebase-admin');
const https = require('https');

// ── CONFIG ──────────────────────────────────────────────────────────────────
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxs1VO_Ai8H7d1DulAOZqHQfGZT3fOidy1AKX8BGsSBQpGdLYuNwDfFyZnnnTy5aJrP/exec';
const MIGRATION_SECRET = 'as-migrate-2026';
const SERVICE_ACCOUNT_PATH = process.argv[2];

if (!SERVICE_ACCOUNT_PATH) {
  console.error('Usage: node migrate-to-firestore.js <serviceAccountPath>');
  process.exit(1);
}

// ── INIT FIREBASE ────────────────────────────────────────────────────────────
const serviceAccount = require(require('path').resolve(SERVICE_ACCOUNT_PATH));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── FETCH FROM APPS SCRIPT ──────────────────────────────────────────────────
function fetchAllData() {
  return new Promise((resolve, reject) => {
    const url = `${APPS_SCRIPT_URL}?action=getAllData&secret=${MIGRATION_SECRET}`;
    https.get(url, (res) => {
      // Apps Script may redirect; follow manually
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirect = res.headers.location;
        https.get(redirect, (res2) => {
          let body = '';
          res2.on('data', d => body += d);
          res2.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch(e) { reject(new Error('Bad JSON: ' + body.slice(0, 200))); }
          });
        }).on('error', reject);
        return;
      }
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { reject(new Error('Bad JSON: ' + body.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

// ── BATCH WRITE HELPER ───────────────────────────────────────────────────────
async function writeBatch(collection, docs, getId) {
  const CHUNK = 400; // Firestore limit is 500 per batch
  let total = 0;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + CHUNK);
    chunk.forEach(doc => {
      const ref = db.collection(collection).doc(getId(doc));
      batch.set(ref, doc);
    });
    await batch.commit();
    total += chunk.length;
    console.log(`  ${collection}: wrote ${total}/${docs.length}`);
  }
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching data from Apps Script…');
  const data = await fetchAllData();

  if (!data.ok) {
    console.error('Apps Script error:', data.error);
    process.exit(1);
  }

  console.log(`Got: ${data.entries.length} entries, ${data.quotes.length} quotes, ` +
    `${data.customers.length} customers, ${data.jobs.length} jobs`);

  // Entries
  console.log('\nMigrating entries…');
  await writeBatch('entries', data.entries, e => e.id);

  // Quotes
  console.log('\nMigrating quotes…');
  await writeBatch('quotes', data.quotes, q => q.id);

  // Lists (all in one batch)
  console.log('\nMigrating lists…');
  const listsBatch = db.batch();
  listsBatch.set(db.collection('lists').doc('customers'),  { values: data.customers });
  listsBatch.set(db.collection('lists').doc('jobs'),       { values: data.jobs });
  listsBatch.set(db.collection('lists').doc('categories'), { values: data.categories });
  listsBatch.set(db.collection('lists').doc('vendors'),    { values: data.vendors });
  listsBatch.set(db.collection('lists').doc('priceGuide'), { items:  data.priceGuide });
  await listsBatch.commit();
  console.log('  lists: customers, jobs, categories, vendors, priceGuide ✓');

  // Settings
  console.log('\nMigrating settings…');
  await db.collection('settings').doc('main').set(data.settings);
  console.log('  settings: pin, defaultMarkup ✓');

  console.log('\n✅ Migration complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
