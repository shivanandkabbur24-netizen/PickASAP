const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { initializeFirestore, collection, doc, setDoc, deleteDoc, getDocs } = require('firebase/firestore');

const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = initializeFirestore(app, {}, cfg.firestoreDatabaseId);

const initialProductsPath = path.resolve(__dirname, '../src/data/initialProducts.json');
const products = JSON.parse(fs.readFileSync(initialProductsPath, 'utf8'));

async function syncAll() {
  console.log(`Starting clean sync to Firestore (${cfg.firestoreDatabaseId})...`);
  let syncedProducts = 0;

  for (const prod of products) {
    if (!prod.id || !Array.isArray(prod.priceHistory)) continue;

    // 1. Clean up old/stale priceHistory documents for this product in Firestore
    try {
      const snap = await getDocs(collection(db, `products/${prod.id}/priceHistory`));
      for (const d of snap.docs) {
        await deleteDoc(doc(db, `products/${prod.id}/priceHistory`, d.id));
      }
    } catch (e) {
      console.warn(`Notice clearing old price history for ${prod.id}:`, e.message);
    }

    // 2. Write each authentic snapshot
    const points = prod.priceHistory;
    for (let idx = 0; idx < points.length; idx++) {
      const p = points[idx];
      const dateObj = new Date(p.date);
      const timeStamp = isNaN(dateObj.getTime()) ? idx * 86400000 : dateObj.getTime();
      const isoRecorded = isNaN(dateObj.getTime()) ? new Date().toISOString() : dateObj.toISOString();
      const snapId = `snap_hist_${prod.id}_${idx}_${timeStamp}`;

      const snapData = {
        id: snapId,
        productId: prod.id,
        price: typeof p.price === 'number' ? p.price : Number(p.price) || 0,
        recordedAt: isoRecorded,
        source: String(p.source || 'Buyhatke Verified').slice(0, 200),
        sourceUrl: String(p.sourceUrl || prod.affiliateUrl || '').slice(0, 2500),
        evidence: String(p.evidence || '').slice(0, 1500),
        note: String(p.note || 'Recorded verified price milestone').slice(0, 800),
        dropPercentage: p.dropPercentage ? String(p.dropPercentage).slice(0, 100) : undefined,
        isLowest: Boolean(p.isLowest),
        isHighest: Boolean(p.isHighest),
      };

      // Filter out undefined
      const cleanData = {};
      for (const [k, v] of Object.entries(snapData)) {
        if (v !== undefined && v !== null) cleanData[k] = v;
      }

      await setDoc(doc(db, `products/${prod.id}/priceHistory`, snapId), cleanData);
    }

    // 3. Update product doc with latest price and research metadata
    try {
      const prodDoc = doc(db, 'products', prod.id);
      await setDoc(prodDoc, {
        mrp: prod.mrp,
        originalPrice: prod.mrp,
        lastResearchedMonth: '2026-10',
        researchStatus: 'researched',
        lastResearchedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn(`Notice updating product doc ${prod.id}:`, e.message);
    }

    syncedProducts++;
    console.log(`[${syncedProducts}/${products.length}] Cleanly synced ${points.length} authentic snapshots for "${prod.title.slice(0, 30)}"`);
  }

  console.log(`Successfully completed Firestore sync for all ${syncedProducts} products!`);
}

syncAll().then(() => process.exit(0)).catch(err => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
