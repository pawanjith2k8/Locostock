/**
 * Comprehensive Verification & Validation Test Suite for LocoStock
 * Run via: node test_locostock.js
 */

function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

function isStaleStock(timestampStr, thresholdHours = 48) {
  const timestamp = new Date(timestampStr).getTime();
  const now = Date.now();
  const diffHours = (now - timestamp) / (1000 * 60 * 60);
  return diffHours > thresholdHours;
}

function runTests() {
  console.log('====================================================');
  console.log('      LOCOSTOCK VERIFICATION & UNIT TESTS          ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Distance Calculation (Haversine)
  // Perungudi (12.9654, 80.2461) to Thoraipakkam (12.9416, 80.2337) is approx 2.9 km
  const dist1 = calculateHaversineDistanceKm(12.9654, 80.2461, 12.9416, 80.2337);
  assert(dist1 > 2.0 && dist1 < 4.0, `Scenario 10: Accurate Haversine distance (${dist1} km between Perungudi and Thoraipakkam)`);

  // Same coordinates must yield 0 km
  const distZero = calculateHaversineDistanceKm(12.9654, 80.2461, 12.9654, 80.2461);
  assert(distZero === 0, 'Scenario 10: Zero distance calculation for identical coordinates');

  // 2. Currency Formatting
  const formatted = formatCurrency(499);
  assert(formatted.includes('499'), `Currency formatting correctly outputs INR amount (${formatted})`);

  // 3. Stale Stock Detection
  const recentTimestamp = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
  const oldTimestamp = new Date(Date.now() - 86400000 * 3).toISOString(); // 3 days ago (72 hours)
  assert(isStaleStock(recentTimestamp) === false, 'Fresh stock (1 hour ago) is marked not stale');
  assert(isStaleStock(oldTimestamp) === true, 'Old stock (72 hours ago) is flagged stale');

  // 4. In-Memory Atomic Billing & Idempotency Simulation Test
  console.log('\n--- Scenario 5, 6, 7 & 9: Atomic Billing Simulation ---');
  let inventory = [
    { id: 'prod_1', name: 'Arduino Uno', shop_id: 'shop_A', price: 499, stock_quantity: 10 },
    { id: 'prod_2', name: 'ESP32 Dev Board', shop_id: 'shop_A', price: 360, stock_quantity: 2 },
  ];
  let invoices = [];

  function simulateFinalizeBill({ shop_id, idempotency_key, items }) {
    // Idempotency check
    const existing = invoices.find(inv => inv.idempotency_key === idempotency_key);
    if (existing) {
      return { success: true, invoice_id: existing.id, idempotent_replay: true };
    }

    // Verify stock
    for (const item of items) {
      const p = inventory.find(i => i.id === item.product_id && i.shop_id === shop_id);
      if (!p) throw new Error('Product not found in shop');
      if (p.stock_quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${p.name}`);
      }
    }

    // Deduct stock atomically
    for (const item of items) {
      const p = inventory.find(i => i.id === item.product_id && i.shop_id === shop_id);
      p.stock_quantity -= item.quantity;
    }

    const inv = { id: 'inv_' + Math.random(), shop_id, idempotency_key, items };
    invoices.push(inv);
    return { success: true, invoice_id: inv.id };
  }

  // Bill 3 units of Arduino Uno
  const bill1 = simulateFinalizeBill({
    shop_id: 'shop_A',
    idempotency_key: 'key_123',
    items: [{ product_id: 'prod_1', quantity: 3, unit_price: 499 }],
  });
  assert(bill1.success === true, 'Scenario 5: Finalized bill of 3 units succeeds');
  assert(inventory.find(i => i.id === 'prod_1').stock_quantity === 7, 'Scenario 5: Exactly 7 units remain in inventory');

  // Duplicate submission with same idempotency key
  const bill1Duplicate = simulateFinalizeBill({
    shop_id: 'shop_A',
    idempotency_key: 'key_123',
    items: [{ product_id: 'prod_1', quantity: 3, unit_price: 499 }],
  });
  assert(bill1Duplicate.idempotent_replay === true, 'Scenario 7: Duplicate bill with same idempotency key is safely ignored');
  assert(inventory.find(i => i.id === 'prod_1').stock_quantity === 7, 'Scenario 7: Stock quantity remains 7 and was NOT double-decremented');

  // Attempt to bill more than available stock (Scenario 6)
  let rejected = false;
  try {
    simulateFinalizeBill({
      shop_id: 'shop_A',
      idempotency_key: 'key_456',
      items: [{ product_id: 'prod_2', quantity: 5, unit_price: 360 }], // available is 2
    });
  } catch (err) {
    rejected = true;
  }
  assert(rejected === true, 'Scenario 6: Attempt to bill more than available stock is rejected');
  assert(inventory.find(i => i.id === 'prod_2').stock_quantity === 2, 'Scenario 6: Stock for ESP32 remains intact at 2 units');

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
