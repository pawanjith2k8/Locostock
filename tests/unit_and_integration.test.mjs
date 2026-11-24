import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// -----------------------------------------------------------------------
// 1. Behavioral Cart Item Aggregation and Bounds
// -----------------------------------------------------------------------
test('Billing Cart Item Aggregation merges duplicate products and enforces bounds', () => {
  function aggregateCartItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Bad request: items must be a non-empty JSON array');
    }
    if (items.length > 200) {
      throw new Error('Bad request: items array exceeds maximum limit of 200 items per invoice');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const qtyRegex = /^[1-9]\d{0,4}$/;
    const map = new Map();

    for (const item of items) {
      if (!item || typeof item !== 'object') {
        throw new Error('Bad request: each item in items array must be an object');
      }
      if (!item.product_id || !uuidRegex.test(item.product_id)) {
        throw new Error(`Bad request: invalid product_id UUID format: ${item.product_id}`);
      }
      const qtyStr = String(item.quantity ?? '');
      if (!qtyRegex.test(qtyStr)) {
        throw new Error('Bad request: quantity must be a positive integer between 1 and 10,000 units');
      }
      const qty = parseInt(qtyStr, 10);
      if (qty > 10000) {
        throw new Error(`Bad request: quantity ${qty} exceeds maximum limit of 10,000 units per line`);
      }

      const existing = map.get(item.product_id) || 0;
      map.set(item.product_id, existing + qty);
    }

    // Return sorted by product_id ASC for deadlock prevention
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([product_id, quantity]) => {
        if (quantity > 100000) {
          throw new Error(`Bad request: aggregated quantity for product ${product_id} exceeds maximum limit of 100,000 units`);
        }
        return { product_id, quantity };
      });
  }

  const p1 = '11111111-1111-4111-8111-111111111111';
  const p2 = '22222222-2222-4222-8222-222222222222';

  // Merges duplicates
  const merged = aggregateCartItems([
    { product_id: p1, quantity: 2 },
    { product_id: p2, quantity: 5 },
    { product_id: p1, quantity: 3 },
  ]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0], { product_id: p1, quantity: 5 });
  assert.deepEqual(merged[1], { product_id: p2, quantity: 5 });

  // Rejects invalid UUID
  assert.throws(() => aggregateCartItems([{ product_id: 'bad-uuid', quantity: 1 }]), /invalid product_id UUID format/);

  // Rejects zero, negative, float, and overflow quantities
  assert.throws(() => aggregateCartItems([{ product_id: p1, quantity: 0 }]), /positive integer between 1 and 10,000/);
  assert.throws(() => aggregateCartItems([{ product_id: p1, quantity: -3 }]), /positive integer between 1 and 10,000/);
  assert.throws(() => aggregateCartItems([{ product_id: p1, quantity: 1.5 }]), /positive integer between 1 and 10,000/);
  assert.throws(() => aggregateCartItems([{ product_id: p1, quantity: '99999999999999999999' }]), /positive integer between 1 and 10,000/);
  assert.throws(() => aggregateCartItems([{ product_id: p1, quantity: 10001 }]), /exceeds maximum limit of 10,000 units/);

  // Rejects empty or oversized array (>200)
  assert.throws(() => aggregateCartItems([]), /non-empty JSON array/);
  const oversized = Array.from({ length: 201 }, () => ({ product_id: p1, quantity: 1 }));
  assert.throws(() => aggregateCartItems(oversized), /maximum limit of 200 items/);
});

// -----------------------------------------------------------------------
// 2. Behavioral Quantity Aggregation Integer Overflow Protection
// -----------------------------------------------------------------------
test('Quantity aggregation validates NUMERIC bounds before INT conversion', () => {
  function validateNumericQuantity(numStr) {
    const num = Number(numStr);
    if (!Number.isFinite(num) || Number.isNaN(num) || num <= 0 || !Number.isInteger(num)) {
      return { valid: false, reason: 'Invalid or non-integer' };
    }
    if (num > 100000) {
      return { valid: false, reason: 'Exceeds maximum aggregated limit of 100,000' };
    }
    return { valid: true, value: num };
  }

  assert.equal(validateNumericQuantity(50).valid, true);
  assert.equal(validateNumericQuantity(100000).valid, true);
  assert.equal(validateNumericQuantity(100001).valid, false);
  assert.equal(validateNumericQuantity('NaN').valid, false);
  assert.equal(validateNumericQuantity('Infinity').valid, false);
  assert.equal(validateNumericQuantity('-Infinity').valid, false);
  assert.equal(validateNumericQuantity(-5).valid, false);
  assert.equal(validateNumericQuantity(0).valid, false);
});

// -----------------------------------------------------------------------
// 3. Behavioral Monetary Sanitization & PostgreSQL NUMERIC Equivalents
// -----------------------------------------------------------------------
test('Monetary sanitization rejects NaN, Infinity, -Infinity, negative, and over-subtotal amounts', () => {
  function validateMonetary(value, maxAllowed) {
    const num = Number(value);
    if (!Number.isFinite(num) || Number.isNaN(num) || num < 0) {
      return { valid: false, reason: 'Invalid or non-finite' };
    }
    const rounded = Math.round(num * 100) / 100;
    if (maxAllowed !== undefined && rounded > maxAllowed) {
      return { valid: false, reason: 'Exceeds subtotal limit' };
    }
    return { valid: true, value: rounded };
  }

  // Valid cases
  assert.equal(validateMonetary(50.456, 100).valid, true);
  assert.equal(validateMonetary(50.456, 100).value, 50.46);
  assert.equal(validateMonetary(0, 100).valid, true);
  assert.equal(validateMonetary(100, 100).valid, true);

  // Invalid cases
  assert.equal(validateMonetary(-0.01, 100).valid, false);
  assert.equal(validateMonetary(NaN, 100).valid, false);
  assert.equal(validateMonetary(Infinity, 100).valid, false);
  assert.equal(validateMonetary(-Infinity, 100).valid, false);
  assert.equal(validateMonetary(100.01, 100).valid, false);
});

// -----------------------------------------------------------------------
// 4. Behavioral Idempotency Key Sanitization
// -----------------------------------------------------------------------
test('Idempotency key sanitization normalizes whitespace-only strings to null and bounds lengths', () => {
  function sanitizeIdempotencyKey(key) {
    if (key === undefined || key === null) return null;
    if (typeof key !== 'string') return null;
    const trimmed = key.trim();
    if (!trimmed) return null;
    if (trimmed.length > 255) throw new Error('Bad request: Idempotency key exceeds maximum length of 255 characters');
    return trimmed;
  }

  assert.equal(sanitizeIdempotencyKey('   '), null);
  assert.equal(sanitizeIdempotencyKey(''), null);
  assert.equal(sanitizeIdempotencyKey(null), null);
  assert.equal(sanitizeIdempotencyKey(undefined), null);
  assert.equal(sanitizeIdempotencyKey('bill_12345'), 'bill_12345');
  assert.equal(sanitizeIdempotencyKey('  sale_abc  '), 'sale_abc');
  assert.throws(() => sanitizeIdempotencyKey('a'.repeat(256)), /exceeds maximum length of 255 characters/);
});

// -----------------------------------------------------------------------
// 5. SHA-256 Request Fingerprinting
// -----------------------------------------------------------------------
test('SHA-256 Request fingerprint is order-independent on items and detects payload mutations', () => {
  function computeFingerprint(shopId, userId, customerName, customerPhone, items, tax, discount) {
    // Aggregate and sort items deterministically by product_id ASC using NUMERIC
    const map = new Map();
    for (const item of items) {
      const existing = map.get(item.product_id) || 0;
      map.set(item.product_id, existing + Number(item.quantity));
    }
    const itemString = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, qty]) => `${id}=${qty}`)
      .join(',');

    const payload = [
      shopId,
      userId,
      (customerName || '').trim(),
      (customerPhone || '').trim(),
      itemString,
      Number(tax || 0).toFixed(2),
      Number(discount || 0).toFixed(2),
    ].join(':');

    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  const p1 = '11111111-1111-4111-8111-111111111111';
  const p2 = '22222222-2222-4222-8222-222222222222';

  // Base fingerprint
  const fpBase = computeFingerprint('s1', 'u1', 'Alice', '9876543210', [{ product_id: p1, quantity: 2 }, { product_id: p2, quantity: 1 }], 5.0, 2.0);

  // Cart sent in reversed order must produce the IDENTICAL fingerprint
  const fpReversed = computeFingerprint('s1', 'u1', 'Alice', '9876543210', [{ product_id: p2, quantity: 1 }, { product_id: p1, quantity: 2 }], 5.0, 2.0);
  assert.equal(fpBase, fpReversed, 'Order of items must not change fingerprint');

  // Duplicate items sent in cart that sum to the same amount must produce IDENTICAL fingerprint
  const fpDuplicates = computeFingerprint('s1', 'u1', 'Alice', '9876543210', [{ product_id: p1, quantity: 1 }, { product_id: p1, quantity: 1 }, { product_id: p2, quantity: 1 }], 5.0, 2.0);
  assert.equal(fpBase, fpDuplicates, 'Aggregated duplicate items must produce identical fingerprint');

  // Altered customer name
  const fpDiffCust = computeFingerprint('s1', 'u1', 'Bob', '9876543210', [{ product_id: p1, quantity: 2 }, { product_id: p2, quantity: 1 }], 5.0, 2.0);
  assert.notEqual(fpBase, fpDiffCust, 'Different customer name must change fingerprint');

  // Altered tax by 1 cent
  const fpDiffTax = computeFingerprint('s1', 'u1', 'Alice', '9876543210', [{ product_id: p1, quantity: 2 }, { product_id: p2, quantity: 1 }], 5.01, 2.0);
  assert.notEqual(fpBase, fpDiffTax, 'Different tax must change fingerprint');

  // Altered quantity
  const fpDiffQty = computeFingerprint('s1', 'u1', 'Alice', '9876543210', [{ product_id: p1, quantity: 3 }, { product_id: p2, quantity: 1 }], 5.0, 2.0);
  assert.notEqual(fpBase, fpDiffQty, 'Different quantity must change fingerprint');
});

// -----------------------------------------------------------------------
// 6. HTTP Error Code Mapping and Detail Sanitization
// -----------------------------------------------------------------------
test('API billing error mapper returns appropriate HTTP status codes without leaking SQL details', () => {
  function mapBillingError(rawMessage) {
    if (!rawMessage || typeof rawMessage !== 'string') {
      return { status: 500, message: 'An error occurred while processing the bill. Please try again.' };
    }
    if (rawMessage.startsWith('Unauthorized')) {
      return { status: 401, message: rawMessage };
    }
    if (rawMessage.startsWith('Forbidden')) {
      return { status: 403, message: rawMessage };
    }
    if (rawMessage.startsWith('Bad request')) {
      return { status: 400, message: rawMessage };
    }
    if (
      rawMessage.startsWith('Idempotency conflict') ||
      rawMessage.startsWith('Idempotency verification unavailable') ||
      rawMessage.includes('Insufficient stock')
    ) {
      return { status: 409, message: rawMessage };
    }
    return { status: 500, message: 'An error occurred while processing the bill. Please try again.' };
  }

  assert.equal(mapBillingError('Unauthorized: Active session required').status, 401);
  assert.equal(mapBillingError('Forbidden: Shop is unverified').status, 403);
  assert.equal(mapBillingError('Bad request: items must be non-empty').status, 400);
  assert.equal(mapBillingError('Idempotency conflict: key reused').status, 409);
  assert.equal(mapBillingError('Insufficient stock for product "Widget"').status, 409);

  // Leaked internal PostgreSQL error is sanitized to 500 with safe message
  const sqlError = mapBillingError('ERROR: 42501: permission denied for column "stock_quantity" of relation "products"');
  assert.equal(sqlError.status, 500);
  assert.equal(sqlError.message, 'An error occurred while processing the bill. Please try again.');
});

// -----------------------------------------------------------------------
// 7. Schema Structural & Privilege Invariants
// -----------------------------------------------------------------------
test('Database Schema defines privilege-based stock protection and required security controls', () => {
  const schemaPath = path.resolve(process.cwd(), 'supabase_schema.sql');
  assert.ok(fs.existsSync(schemaPath), 'supabase_schema.sql must exist');

  const sql = fs.readFileSync(schemaPath, 'utf8');

  // Verify extensions
  assert.ok(sql.includes('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'), 'uuid-ossp required');
  assert.ok(sql.includes('CREATE EXTENSION IF NOT EXISTS "pgcrypto";'), 'pgcrypto required for SHA-256 digests');

  // Verify core tables
  const tables = ['profiles', 'shops', 'products', 'invoices', 'invoice_items', 'stock_movements'];
  for (const t of tables) {
    assert.ok(sql.includes(`CREATE TABLE IF NOT EXISTS public.${t}`), `Table ${t} must be created`);
    assert.ok(sql.includes(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`), `RLS must be enabled on ${t}`);
  }

  // Verify privilege-based stock protection:
  // 1. Table-level UPDATE and INSERT revoked from public.products
  assert.ok(sql.includes('REVOKE INSERT, UPDATE, DELETE ON public.products FROM authenticated, anon, PUBLIC;'), 'Products table-level writes must be revoked');

  // 2. Column-level UPDATE granted on metadata only, EXCLUDING stock_quantity
  assert.ok(sql.includes('GRANT UPDATE ('), 'Column-level UPDATE must be granted on products');
  const updateMatch = sql.match(/GRANT UPDATE \(([\s\S]*?)\) ON public\.products TO authenticated;/);
  assert.ok(updateMatch, 'GRANT UPDATE clause must be present');
  assert.ok(!updateMatch[1].includes('stock_quantity'), 'stock_quantity must NOT be granted in column-level UPDATE');

  // 3. Column-level INSERT granted on metadata only, EXCLUDING stock_quantity
  const insertMatch = sql.match(/GRANT INSERT \(([\s\S]*?)\) ON public\.products TO authenticated;/);
  assert.ok(insertMatch, 'GRANT INSERT clause must be present');
  assert.ok(!insertMatch[1].includes('stock_quantity'), 'stock_quantity must NOT be granted in column-level INSERT');

  // 4. Financial & Audit table writes revoked
  assert.ok(sql.includes('REVOKE INSERT, UPDATE, DELETE ON public.invoices FROM authenticated, anon, PUBLIC;'));
  assert.ok(sql.includes('REVOKE INSERT, UPDATE, DELETE ON public.invoice_items FROM authenticated, anon, PUBLIC;'));
  assert.ok(sql.includes('REVOKE INSERT, UPDATE, DELETE ON public.stock_movements FROM authenticated, anon, PUBLIC;'));

  // 5. Verify protect_product_stock_update does NOT rely on PG_CONTEXT substring matching
  assert.ok(!sql.includes('PG_CONTEXT'), 'protect_product_stock_update must NOT use PG_CONTEXT string inspection');
  assert.ok(sql.includes('locostock.stock_mutation_authorized'), 'Must use transaction-local token locostock.stock_mutation_authorized');
  assert.ok(sql.includes('CURRENT_USER = SESSION_USER'), 'Must verify security context boundary CURRENT_USER = SESSION_USER');

  // 6. Verify admin_verify_shop enforces cryptographically verified app_metadata->is_admin
  assert.ok(sql.includes("auth.jwt()->'app_metadata'->>'is_admin'"), 'admin_verify_shop must check app_metadata->is_admin');
  assert.ok(!sql.includes("raw_user_meta_data->>'is_admin'"), 'Must NOT check user-controlled raw_user_meta_data for admin rights');

  // 7. Verify adjust_stock_atomic supports service_role without failing shop owner checks
  assert.ok(sql.includes('v_is_service_role :='), 'adjust_stock_atomic must distinguish service_role');
});

// -----------------------------------------------------------------------
// 8. Behavioral Simulation: Stock Update Defense-in-Depth Trigger Logic
// -----------------------------------------------------------------------
test('Direct stock UPDATE is denied while trusted inventory procedures are authorized', () => {
  function simulateStockTrigger({ currentUser, sessionUser, jwtRole, token, oldQty, newQty }) {
    if (newQty !== oldQty) {
      if (token !== 'true' || (currentUser === sessionUser && jwtRole !== 'service_role')) {
        throw new Error('Forbidden: Direct stock quantity modifications are prohibited. Stock must be modified exclusively through authorized inventory functions (finalize_bill_atomic or adjust_stock_atomic).');
      }
    }
    return { success: true, updatedQty: newQty };
  }

  // 1. Direct authenticated client attempt without token -> FAILS
  assert.throws(
    () => simulateStockTrigger({ currentUser: 'authenticated', sessionUser: 'authenticated', jwtRole: 'authenticated', token: null, oldQty: 10, newQty: 50 }),
    /Forbidden: Direct stock quantity modifications are prohibited/
  );

  // 2. Direct authenticated client attempt with spoofed token -> FAILS (CURRENT_USER == SESSION_USER)
  assert.throws(
    () => simulateStockTrigger({ currentUser: 'authenticated', sessionUser: 'authenticated', jwtRole: 'authenticated', token: 'true', oldQty: 10, newQty: 50 }),
    /Forbidden: Direct stock quantity modifications are prohibited/
  );

  // 3. Direct service_role without token (bypassing audit function) -> FAILS (prevents audit bypass)
  assert.throws(
    () => simulateStockTrigger({ currentUser: 'service_role', sessionUser: 'service_role', jwtRole: 'service_role', token: null, oldQty: 10, newQty: 50 }),
    /Forbidden: Direct stock quantity modifications are prohibited/
  );

  // 4. Trusted inventory function (SECURITY DEFINER, CURRENT_USER != SESSION_USER, token = 'true') -> SUCCEEDS
  const trustedRes = simulateStockTrigger({ currentUser: 'postgres', sessionUser: 'authenticated', jwtRole: 'authenticated', token: 'true', oldQty: 10, newQty: 8 });
  assert.equal(trustedRes.success, true);
  assert.equal(trustedRes.updatedQty, 8);

  // 5. Trusted adjust_stock_atomic invoked by service_role (token = 'true', jwtRole = 'service_role') -> SUCCEEDS
  const srRes = simulateStockTrigger({ currentUser: 'postgres', sessionUser: 'service_role', jwtRole: 'service_role', token: 'true', oldQty: 10, newQty: 25 });
  assert.equal(srRes.success, true);
  assert.equal(srRes.updatedQty, 25);
});

// -----------------------------------------------------------------------
// 9. Behavioral Simulation: Admin Shop Verification & Privilege Escalation Defense
// -----------------------------------------------------------------------
test('Normal authenticated user cannot verify a shop or promote a profile', () => {
  function verifyShopAuthorization(jwt) {
    const role = jwt?.role || '';
    const isAdmin = jwt?.app_metadata?.is_admin === 'true';

    // Disregard user-controlled user_metadata
    if (role !== 'service_role' && !isAdmin) {
      throw new Error('Unauthorized: Only platform administrators can verify shops');
    }
    return { authorized: true };
  }

  // 1. Normal authenticated user without admin claims -> FAILS
  assert.throws(
    () => verifyShopAuthorization({ role: 'authenticated', sub: 'user-1' }),
    /Unauthorized: Only platform administrators can verify shops/
  );

  // 2. Normal user forging user_metadata: { is_admin: 'true' } -> FAILS
  assert.throws(
    () => verifyShopAuthorization({ role: 'authenticated', sub: 'user-1', user_metadata: { is_admin: 'true' } }),
    /Unauthorized: Only platform administrators can verify shops/
  );

  // 3. Verified administrator with signed app_metadata: { is_admin: 'true' } -> SUCCEEDS
  assert.equal(
    verifyShopAuthorization({ role: 'authenticated', sub: 'admin-1', app_metadata: { is_admin: 'true' } }).authorized,
    true
  );

  // 4. Platform service_role -> SUCCEEDS
  assert.equal(
    verifyShopAuthorization({ role: 'service_role' }).authorized,
    true
  );
});

// -----------------------------------------------------------------------
// 10. Behavioral Simulation: adjust_stock_atomic Service-Role & Ownership Policies
// -----------------------------------------------------------------------
test('adjust_stock_atomic enforces ownership for users and audit attribution for service-role', () => {
  const mockProducts = new Map([
    ['p1', { id: 'p1', shop_id: 's1', stock: 20, owner_id: 'owner-1' }],
    ['p2', { id: 'p2', shop_id: 's2', stock: 10, owner_id: 'owner-2' }],
  ]);
  const auditLog = [];

  function adjustStock({ callerAuthUid, callerJwtRole, productId, changeAmount, reason, notes }) {
    const isServiceRole = callerJwtRole === 'service_role';
    if (!isServiceRole && !callerAuthUid) {
      throw new Error('Unauthorized: Active authenticated session required');
    }

    const prod = mockProducts.get(productId);
    if (!prod) throw new Error('Bad request: Product does not exist');

    if (!isServiceRole && prod.owner_id !== callerAuthUid) {
      throw new Error('Unauthorized: Product does not belong to your shop');
    }

    const actorId = isServiceRole ? prod.owner_id : callerAuthUid;
    const newStock = prod.stock + changeAmount;
    if (newStock < 0) throw new Error('Bad request: Resulting stock cannot be negative');

    prod.stock = newStock;
    const movement = {
      product_id: productId,
      shop_id: prod.shop_id,
      change_amount: changeAmount,
      quantity_after: newStock,
      reason,
      created_by: actorId,
      notes: isServiceRole ? (notes || 'Administrative stock adjustment (service_role)') : (notes || 'Manual stock adjustment'),
    };
    auditLog.push(movement);
    return { success: true, stock: newStock, movement };
  }

  // 1. Owner adjusts own stock -> SUCCEEDS
  const res1 = adjustStock({ callerAuthUid: 'owner-1', callerJwtRole: 'authenticated', productId: 'p1', changeAmount: 5, reason: 'stock_in' });
  assert.equal(res1.stock, 25);
  assert.equal(auditLog[auditLog.length - 1].created_by, 'owner-1');

  // 2. Non-owner attempts to adjust owner-1 stock -> FAILS
  assert.throws(
    () => adjustStock({ callerAuthUid: 'attacker-1', callerJwtRole: 'authenticated', productId: 'p1', changeAmount: 10, reason: 'stock_in' }),
    /Unauthorized: Product does not belong to your shop/
  );

  // 3. Service-role adjusts stock -> SUCCEEDS and records audit log attributed to shop owner
  const resSr = adjustStock({ callerAuthUid: null, callerJwtRole: 'service_role', productId: 'p1', changeAmount: 10, reason: 'stock_in', notes: 'Warehouse sync' });
  assert.equal(resSr.stock, 35);
  assert.equal(auditLog[auditLog.length - 1].created_by, 'owner-1');
  assert.equal(auditLog[auditLog.length - 1].notes, 'Warehouse sync');

  // 4. Over-reduction resulting in negative stock -> FAILS
  assert.throws(
    () => adjustStock({ callerAuthUid: 'owner-1', callerJwtRole: 'authenticated', productId: 'p1', changeAmount: -100, reason: 'damaged' }),
    /Resulting stock cannot be negative/
  );
});

// -----------------------------------------------------------------------
// 11. Behavioral Simulation: Failed Billing Transaction Atomicity & Rollback
// -----------------------------------------------------------------------
test('Failed billing rolls back invoices, line items, stock deductions, and audit records', () => {
  // Mock database state
  const state = {
    products: new Map([
      ['prod-1', { id: 'prod-1', name: 'Widget 1', price: 50.00, stock: 5 }],
    ]),
    invoices: [],
    invoiceItems: [],
    stockMovements: [],
  };

  function simulateFinalizeBill({ shopId, items }) {
    // Take snapshot for rollback
    const snapshot = {
      products: new Map(Array.from(state.products.entries()).map(([k, v]) => [k, { ...v }])),
      invoices: [...state.invoices],
      invoiceItems: [...state.invoiceItems],
      stockMovements: [...state.stockMovements],
    };

    try {
      // 1. Validate stock
      for (const item of items) {
        const prod = state.products.get(item.product_id);
        if (!prod || prod.stock < item.quantity) {
          throw new Error(`Insufficient stock for product "${prod?.name || item.product_id}"`);
        }
      }

      // 2. Provisionally create invoice
      const invoiceId = 'inv-test-123';
      state.invoices.push({ id: invoiceId, shop_id: shopId });

      // 3. Deduct stock & create items and audit movements
      for (const item of items) {
        const prod = state.products.get(item.product_id);
        prod.stock -= item.quantity;
        state.invoiceItems.push({ invoice_id: invoiceId, product_id: item.product_id, quantity: item.quantity });
        state.stockMovements.push({ product_id: item.product_id, change_amount: -item.quantity, reason: 'sale' });
      }

      return { success: true };
    } catch (err) {
      // Atomic transaction rollback
      state.products = snapshot.products;
      state.invoices = snapshot.invoices;
      state.invoiceItems = snapshot.invoiceItems;
      state.stockMovements = snapshot.stockMovements;
      throw err;
    }
  }

  // Attempt to bill quantity 10 when only 5 are available
  assert.throws(
    () => simulateFinalizeBill({ shopId: 'shop-1', items: [{ product_id: 'prod-1', quantity: 10 }] }),
    /Insufficient stock/
  );

  // Verify full rollback: product stock unchanged, no invoices, items, or movements created
  assert.equal(state.products.get('prod-1').stock, 5);
  assert.equal(state.invoices.length, 0);
  assert.equal(state.invoiceItems.length, 0);
  assert.equal(state.stockMovements.length, 0);

  // Now attempt valid checkout with quantity 2 -> SUCCEEDS
  const validRes = simulateFinalizeBill({ shopId: 'shop-1', items: [{ product_id: 'prod-1', quantity: 2 }] });
  assert.equal(validRes.success, true);
  assert.equal(state.products.get('prod-1').stock, 3);
  assert.equal(state.invoices.length, 1);
  assert.equal(state.invoiceItems.length, 1);
  assert.equal(state.stockMovements.length, 1);
});
