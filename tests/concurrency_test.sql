-- =======================================================================
-- LOCOSTOCK CONCURRENCY, DEADLOCK & OVERSELLING TEST SUITE (TWO SESSIONS)
-- =======================================================================
-- INSTRUCTIONS: Open two simultaneous psql sessions or database client tabs
-- connected to your staging Supabase database to verify transaction locking,
-- deadlock prevention, concurrent duplicate handling, and overselling protection.

-- -----------------------------------------------------------------------
-- TEST SCENARIO A: Concurrent Duplicate Billing (Same Idempotency Key)
-- -----------------------------------------------------------------------
-- Session 1:
BEGIN;
SELECT public.finalize_bill_atomic(
  p_shop_id => 'SHOP_UUID_HERE',
  p_idempotency_key => 'concurrent_test_key_01',
  p_items => '[{"product_id": "PRODUCT_A_UUID", "quantity": 1}]'::jsonb
);
-- (DO NOT COMMIT YET; leave transaction open)

-- Session 2 (Immediately run while Session 1 is open):
BEGIN;
SELECT public.finalize_bill_atomic(
  p_shop_id => 'SHOP_UUID_HERE',
  p_idempotency_key => 'concurrent_test_key_01',
  p_items => '[{"product_id": "PRODUCT_A_UUID", "quantity": 1}]'::jsonb
);
-- EXPECTED OUTCOME: Session 2 cleanly blocks on pg_advisory_xact_lock until Session 1 completes.

-- Session 1:
COMMIT;

-- Session 2:
-- EXPECTED OUTCOME: Session 2 immediately unblocks and returns the idempotent replay of
-- Session 1's invoice (idempotent_replay: true) without double-decrementing stock.
COMMIT;


-- -----------------------------------------------------------------------
-- TEST SCENARIO B: Deadlock Prevention on Interleaved Multi-Item Carts
-- -----------------------------------------------------------------------
-- Session 1: Cart contains Product A then Product B
BEGIN;
SELECT public.finalize_bill_atomic(
  p_shop_id => 'SHOP_UUID_HERE',
  p_idempotency_key => 'concurrent_deadlock_01',
  p_items => '[
    {"product_id": "PRODUCT_A_UUID", "quantity": 1},
    {"product_id": "PRODUCT_B_UUID", "quantity": 1}
  ]'::jsonb
);

-- Session 2 (Simultaneously submitted cart with Product B then Product A):
BEGIN;
SELECT public.finalize_bill_atomic(
  p_shop_id => 'SHOP_UUID_HERE',
  p_idempotency_key => 'concurrent_deadlock_02',
  p_items => '[
    {"product_id": "PRODUCT_B_UUID", "quantity": 1},
    {"product_id": "PRODUCT_A_UUID", "quantity": 1}
  ]'::jsonb
);
-- EXPECTED OUTCOME: Because finalize_bill_atomic sorts items deterministically by product_id ASC
-- before acquiring SELECT FOR UPDATE, no circular wait can occur. Deadlock is eliminated.

-- Both sessions commit cleanly:
-- Session 1:
COMMIT;
-- Session 2:
COMMIT;


-- -----------------------------------------------------------------------
-- TEST SCENARIO C: Concurrent Inventory Contention (Preventing Overselling)
-- -----------------------------------------------------------------------
-- Assume Product C has stock_quantity = 5.
-- Session 1 attempts to buy 4 units; Session 2 attempts to buy 3 units simultaneously.
-- Combined demand is 7, which exceeds available stock (5).

-- Session 1:
BEGIN;
SELECT public.finalize_bill_atomic(
  p_shop_id => 'SHOP_UUID_HERE',
  p_idempotency_key => 'concurrent_stock_01',
  p_items => '[{"product_id": "PRODUCT_C_UUID", "quantity": 4}]'::jsonb
);
-- (DO NOT COMMIT YET; Session 1 holds FOR UPDATE row lock on Product C)

-- Session 2 (Executes simultaneously):
BEGIN;
SELECT public.finalize_bill_atomic(
  p_shop_id => 'SHOP_UUID_HERE',
  p_idempotency_key => 'concurrent_stock_02',
  p_items => '[{"product_id": "PRODUCT_C_UUID", "quantity": 3}]'::jsonb
);
-- EXPECTED OUTCOME: Session 2 blocks waiting for the row lock on Product C.

-- Session 1:
COMMIT;
-- Session 1 commits: Product C stock drops from 5 to 1.

-- Session 2:
-- EXPECTED OUTCOME: Session 2 unblocks, acquires row lock, reads updated stock (1),
-- detects that requested quantity (3) > available stock (1), raises exception:
-- "Insufficient stock for product...", and cleanly aborts. Stock NEVER becomes negative!
ROLLBACK;
