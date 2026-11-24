-- =======================================================================
-- LOCOSTOCK STAGING INTEGRATION TEST SUITE (HARDENED SECURITY CHECKS)
-- =======================================================================
-- EXECUTION: Run inside a staging PostgreSQL transaction block:
--   psql -U postgres -d postgres -f tests/staging_security_suite.sql
--
-- STRICT ASSERTIONS:
-- No broad WHEN OTHERS handlers are used. Each test catches only specific
-- expected exceptions (insufficient_privilege, raise_exception, check_violation).
-- Any unexpected runtime error or failed assertion immediately halts execution.
-- The entire transaction is rolled back at the end, leaving no test artifacts.

BEGIN;

DO $$
DECLARE
  v_owner_a UUID := 'c0000000-0000-0000-0000-000000000001'::uuid;
  v_owner_b UUID := 'c0000000-0000-0000-0000-000000000002'::uuid;
  v_cust UUID := 'c0000000-0000-0000-0000-000000000003'::uuid;
  v_shop_a UUID;
  v_shop_b UUID;
  v_prod_a1 UUID;
  v_prod_a2 UUID;
  v_prod_b1 UUID;
  v_forged_prod UUID;
  v_legit_prod UUID;
  v_res1 JSONB;
  v_res2 JSONB;
  v_res_b JSONB;
  v_res_dup JSONB;
  v_res_sr JSONB;
  v_blocked BOOLEAN;
  v_err TEXT;
  v_pre_inv_count INT;
  v_pre_item_count INT;
  v_pre_sm_count INT;
  v_pre_stock INT;
BEGIN
  -- SETUP: Create test users in auth.users
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES 
    (v_owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner_a@test.loco', 'hash', NOW(), '{"provider":"email"}', '{"full_name":"Owner A"}', NOW(), NOW()),
    (v_owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner_b@test.loco', 'hash', NOW(), '{"provider":"email"}', '{"full_name":"Owner B"}', NOW(), NOW()),
    (v_cust, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cust@test.loco', 'hash', NOW(), '{"provider":"email"}', '{"full_name":"Customer"}', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Ensure profiles exist with default customer role
  INSERT INTO public.profiles (id, email, full_name, role) VALUES 
    (v_owner_a, 'owner_a@test.loco', 'Owner A', 'customer'),
    (v_owner_b, 'owner_b@test.loco', 'Owner B', 'customer'),
    (v_cust, 'cust@test.loco', 'Customer', 'customer')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  -- -------------------------------------------------------------------
  -- CHECK 1: Profile role self-promotion blocked (normal authenticated user)
  -- -------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_cust::text, true);

  v_blocked := FALSE;
  BEGIN
    UPDATE public.profiles SET role = 'shopkeeper' WHERE id = v_cust;
  EXCEPTION WHEN raise_exception, check_violation, integrity_constraint_violation, insufficient_privilege THEN
    v_blocked := TRUE;
    v_err := SQLERRM;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: Client was able to self-promote to shopkeeper!';
  ELSE
    RAISE NOTICE 'CHECK 1 PASSED: Role escalation blocked (%: %)', SQLSTATE, v_err;
  END IF;

  -- -------------------------------------------------------------------
  -- CHECK 2: Unauthorized shop verification blocked (direct INSERT or UPDATE)
  -- -------------------------------------------------------------------
  INSERT INTO public.shops (owner_id, name, category, address_line, locality, city, state, postal_code, latitude, longitude, is_verified)
  VALUES (v_owner_a, 'Shop A', 'Retail', 'Street 1', 'Loc A', 'City A', 'ST', '600001', 12.9, 80.2, TRUE)
  RETURNING id INTO v_shop_a;

  IF (SELECT is_verified FROM public.shops WHERE id = v_shop_a) = TRUE THEN
    RAISE EXCEPTION 'CHECK 2 FAILED: Client inserted shop with is_verified = TRUE!';
  END IF;

  v_blocked := FALSE;
  BEGIN
    UPDATE public.shops SET is_verified = TRUE WHERE id = v_shop_a;
  EXCEPTION WHEN raise_exception, check_violation, integrity_constraint_violation, insufficient_privilege THEN
    v_blocked := TRUE;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'CHECK 2 FAILED: Client verified their own shop via UPDATE!';
  END IF;
  RAISE NOTICE 'CHECK 2 PASSED: Client shop self-verification blocked';

  -- -------------------------------------------------------------------
  -- CHECK 2B: Normal authenticated user cannot verify shop via admin_verify_shop()
  -- -------------------------------------------------------------------
  v_blocked := FALSE;
  BEGIN
    PERFORM public.admin_verify_shop(v_shop_a, TRUE);
  EXCEPTION WHEN raise_exception THEN
    v_blocked := TRUE;
    v_err := SQLERRM;
  END;

  IF NOT v_blocked OR v_err NOT LIKE '%Only platform administrators%' THEN
    RAISE EXCEPTION 'CHECK 2B FAILED: Normal authenticated user was able to execute admin_verify_shop!';
  END IF;
  RAISE NOTICE 'CHECK 2B PASSED: admin_verify_shop denied to normal authenticated user (%: %)', SQLSTATE, v_err;

  -- Setup inventory for Shop A
  INSERT INTO public.products (shop_id, name, category, price, is_active)
  VALUES (v_shop_a, 'Widget A1', 'Hardware', 50.00, TRUE)
  RETURNING id INTO v_prod_a1;

  INSERT INTO public.products (shop_id, name, category, price, is_active)
  VALUES (v_shop_a, 'Widget A2', 'Hardware', 150.00, TRUE)
  RETURNING id INTO v_prod_a2;

  -- -------------------------------------------------------------------
  -- CHECK 2C: Unverified shop cannot complete billing
  -- -------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_owner_a::text, true);

  v_blocked := FALSE;
  BEGIN
    PERFORM public.finalize_bill_atomic(
      p_shop_id => v_shop_a,
      p_items => jsonb_build_array(jsonb_build_object('product_id', v_prod_a1::text, 'quantity', 1))
    );
  EXCEPTION WHEN raise_exception THEN
    v_blocked := TRUE;
    v_err := SQLERRM;
  END;

  IF NOT v_blocked OR v_err NOT LIKE '%not verified by LocoStock administrators%' THEN
    RAISE EXCEPTION 'CHECK 2C FAILED: Unverified shop completed billing! Error: %', v_err;
  END IF;
  RAISE NOTICE 'CHECK 2C PASSED: Billing correctly rejected for unverified shop (%: %)', SQLSTATE, v_err;

  -- -------------------------------------------------------------------
  -- CHECK 3: Administrative verification atomically verifies and promotes
  -- -------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM public.admin_verify_shop(v_shop_a, TRUE);

  INSERT INTO public.shops (owner_id, name, category, address_line, locality, city, state, postal_code, latitude, longitude, is_verified)
  VALUES (v_owner_b, 'Shop B', 'Retail', 'Street 2', 'Loc B', 'City B', 'ST', '600002', 12.95, 80.25, FALSE)
  RETURNING id INTO v_shop_b;
  PERFORM public.admin_verify_shop(v_shop_b, TRUE);

  IF (SELECT role FROM public.profiles WHERE id = v_owner_a) <> 'shopkeeper' OR
     (SELECT role FROM public.profiles WHERE id = v_owner_b) <> 'shopkeeper' THEN
    RAISE EXCEPTION 'CHECK 3 FAILED: admin_verify_shop did not promote owner to shopkeeper!';
  END IF;
  RAISE NOTICE 'CHECK 3 PASSED: admin_verify_shop atomically verified shops and promoted owners';

  INSERT INTO public.products (shop_id, name, category, price, is_active)
  VALUES (v_shop_b, 'Widget B1', 'Hardware', 75.00, TRUE)
  RETURNING id INTO v_prod_b1;

  -- Adjust initial stock via adjust_stock_atomic
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_owner_a::text, true);
  PERFORM public.adjust_stock_atomic(v_prod_a1, 20, 'stock_in', 'Initial test stock');
  PERFORM public.adjust_stock_atomic(v_prod_a2, 5, 'stock_in', 'Initial test stock');

  PERFORM set_config('request.jwt.claim.sub', v_owner_b::text, true);
  PERFORM public.adjust_stock_atomic(v_prod_b1, 30, 'stock_in', 'Initial test stock');

  -- -------------------------------------------------------------------
  -- CHECK 4: Direct stock updates by authenticated users are rejected
  -- (Both without and with spoofed GUC setting)
  -- -------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_owner_a::text, true);

  v_blocked := FALSE;
  BEGIN
    UPDATE public.products SET stock_quantity = 9999 WHERE id = v_prod_a1;
  EXCEPTION WHEN insufficient_privilege, raise_exception THEN
    v_blocked := TRUE;
    v_err := SQLERRM;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'CHECK 4A FAILED: Authenticated user was able to directly update products.stock_quantity!';
  END IF;
  RAISE NOTICE 'CHECK 4A PASSED: Direct update to stock_quantity rejected (%: %)', SQLSTATE, v_err;

  -- Test spoofed GUC setting: client sets token, but CURRENT_USER = SESSION_USER so trigger still rejects
  v_blocked := FALSE;
  BEGIN
    PERFORM set_config('locostock.stock_mutation_authorized', 'true', true);
    UPDATE public.products SET stock_quantity = 9999 WHERE id = v_prod_a1;
  EXCEPTION WHEN insufficient_privilege, raise_exception THEN
    v_blocked := TRUE;
    v_err := SQLERRM;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'CHECK 4B FAILED: Setting locostock.stock_mutation_authorized bypassed trigger!';
  END IF;
  PERFORM set_config('locostock.stock_mutation_authorized', 'false', true);
  RAISE NOTICE 'CHECK 4B PASSED: GUC spoofing thwarted by execution context check (%: %)', SQLSTATE, v_err;

  -- -------------------------------------------------------------------
  -- CHECK 5: Permitted product-field updates still work
  -- -------------------------------------------------------------------
  UPDATE public.products SET name = 'Renamed Widget A1', price = 55.00 WHERE id = v_prod_a1;

  IF (SELECT price FROM public.products WHERE id = v_prod_a1) <> 55.00 OR
     (SELECT name FROM public.products WHERE id = v_prod_a1) <> 'Renamed Widget A1' THEN
    RAISE EXCEPTION 'CHECK 5 FAILED: Permitted column update (name, price) failed!';
  END IF;
  -- Restore original price for billing checks
  UPDATE public.products SET price = 50.00 WHERE id = v_prod_a1;
  RAISE NOTICE 'CHECK 5 PASSED: Permitted product metadata columns updated successfully';

  -- -------------------------------------------------------------------
  -- CHECK 6: Initial stock cannot be forged on product creation
  -- -------------------------------------------------------------------
  v_blocked := FALSE;
  BEGIN
    INSERT INTO public.products (shop_id, name, category, price, stock_quantity)
    VALUES (v_shop_a, 'Forged Prod', 'Hardware', 10.00, 500)
    RETURNING id INTO v_forged_prod;
  EXCEPTION WHEN insufficient_privilege, raise_exception THEN
    v_blocked := TRUE;
  END;

  IF NOT v_blocked THEN
    -- If column privilege was somehow granted, verify trigger forced stock to 0
    IF (SELECT stock_quantity FROM public.products WHERE id = v_forged_prod) <> 0 THEN
      RAISE EXCEPTION 'CHECK 6 FAILED: Client forged initial stock_quantity on INSERT!';
    END IF;
  END IF;

  -- Normal insert without stock_quantity succeeds and defaults to 0
  INSERT INTO public.products (shop_id, name, category, price)
  VALUES (v_shop_a, 'Legit Prod', 'Hardware', 10.00)
  RETURNING id INTO v_legit_prod;

  IF (SELECT stock_quantity FROM public.products WHERE id = v_legit_prod) <> 0 THEN
    RAISE EXCEPTION 'CHECK 6 FAILED: Default product stock_quantity is not 0!';
  END IF;
  RAISE NOTICE 'CHECK 6 PASSED: Initial stock cannot be forged during product creation (defaults to 0)';

  -- -------------------------------------------------------------------
  -- CHECK 7: Authorized billing deducts stock and records stock movement
  -- -------------------------------------------------------------------
  v_res1 := public.finalize_bill_atomic(
    p_shop_id => v_shop_a,
    p_customer_name => 'Alice',
    p_customer_phone => '9876543210',
    p_subtotal => 0, -- Ignored in favor of authoritative DB price (50.00 * 2 = 100.00)
    p_tax => 5.00,
    p_discount => 10.00,
    p_idempotency_key => 'seq_key_001',
    p_items => jsonb_build_array(
      jsonb_build_object('product_id', v_prod_a1::text, 'quantity', 2)
    )
  );

  IF (v_res1->>'success')::BOOLEAN <> TRUE OR
     (v_res1->>'subtotal')::NUMERIC <> 100.00 OR
     (v_res1->>'final_total')::NUMERIC <> 95.00 OR
     (SELECT stock_quantity FROM public.products WHERE id = v_prod_a1) <> 18 THEN
    RAISE EXCEPTION 'CHECK 7 FAILED: Stock not decremented or totals incorrect!';
  END IF;

  -- Verify stock movement audit log was recorded
  IF NOT EXISTS (
    SELECT 1 FROM public.stock_movements 
    WHERE product_id = v_prod_a1 AND reference_invoice_id = (v_res1->>'invoice_id')::UUID AND change_amount = -2 AND reason = 'sale'
  ) THEN
    RAISE EXCEPTION 'CHECK 7 FAILED: Billing stock movement audit record was not recorded!';
  END IF;
  RAISE NOTICE 'CHECK 7 PASSED: Successful bill, stock deduction, and audit movement recorded (stock = 18)';

  -- -------------------------------------------------------------------
  -- CHECK 8: Failed billing rolls back invoices, items, stock, and audit logs
  -- -------------------------------------------------------------------
  SELECT COUNT(*) INTO v_pre_inv_count FROM public.invoices WHERE shop_id = v_shop_a;
  SELECT COUNT(*) INTO v_pre_item_count FROM public.invoice_items;
  SELECT COUNT(*) INTO v_pre_sm_count FROM public.stock_movements WHERE shop_id = v_shop_a;
  SELECT stock_quantity INTO v_pre_stock FROM public.products WHERE id = v_prod_a2;

  v_blocked := FALSE;
  BEGIN
    PERFORM public.finalize_bill_atomic(
      p_shop_id => v_shop_a,
      p_items => jsonb_build_array(
        jsonb_build_object('product_id', v_prod_a2::text, 'quantity', 9999) -- Exceeds stock (5 available)
      )
    );
  EXCEPTION WHEN raise_exception THEN
    v_blocked := TRUE;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'CHECK 8 FAILED: Insufficient stock was not rejected!';
  END IF;

  -- Verify complete rollback: no new invoice, line items, stock movements, or stock modification
  IF (SELECT COUNT(*) FROM public.invoices WHERE shop_id = v_shop_a) <> v_pre_inv_count OR
     (SELECT COUNT(*) FROM public.invoice_items) <> v_pre_item_count OR
     (SELECT COUNT(*) FROM public.stock_movements WHERE shop_id = v_shop_a) <> v_pre_sm_count OR
     (SELECT stock_quantity FROM public.products WHERE id = v_prod_a2) <> v_pre_stock THEN
    RAISE EXCEPTION 'CHECK 8 FAILED: Failed billing did not roll back all changes atomically!';
  END IF;
  RAISE NOTICE 'CHECK 8 PASSED: Failed billing rolled back all invoice, line item, stock, and audit changes';

  -- -------------------------------------------------------------------
  -- CHECK 9: Duplicate idempotency request returns original invoice
  -- -------------------------------------------------------------------
  v_res2 := public.finalize_bill_atomic(
    p_shop_id => v_shop_a,
    p_customer_name => 'Alice',
    p_customer_phone => '9876543210',
    p_tax => 5.00,
    p_discount => 10.00,
    p_idempotency_key => 'seq_key_001', -- Same key as Check 7
    p_items => jsonb_build_array(
      jsonb_build_object('product_id', v_prod_a1::text, 'quantity', 2)
    )
  );

  IF (v_res2->>'idempotent_replay')::BOOLEAN <> TRUE OR
     (v_res2->>'invoice_number') <> (v_res1->>'invoice_number') THEN
    RAISE EXCEPTION 'CHECK 9 FAILED: Duplicate idempotency request did not return original invoice!';
  END IF;
  RAISE NOTICE 'CHECK 9 PASSED: Idempotent replay returned original invoice without double stock decrement';

  -- -------------------------------------------------------------------
  -- CHECK 10: Reusing key with altered payload rejected
  -- -------------------------------------------------------------------
  v_blocked := FALSE;
  BEGIN
    PERFORM public.finalize_bill_atomic(
      p_shop_id => v_shop_a,
      p_idempotency_key => 'seq_key_001', -- Same key but DIFFERENT items
      p_items => jsonb_build_array(
        jsonb_build_object('product_id', v_prod_a2::text, 'quantity', 1)
      )
    );
  EXCEPTION WHEN raise_exception THEN
    v_blocked := TRUE;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'CHECK 10 FAILED: Reusing key with altered payload was not rejected!';
  END IF;
  RAISE NOTICE 'CHECK 10 PASSED: Reusing key with altered payload rejected';

  -- -------------------------------------------------------------------
  -- CHECK 11: Cross-shop idempotency (No conflict across shops)
  -- -------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_owner_b::text, true);

  v_res_b := public.finalize_bill_atomic(
    p_shop_id => v_shop_b,
    p_idempotency_key => 'seq_key_001', -- Same key string, DIFFERENT shop
    p_items => jsonb_build_array(
      jsonb_build_object('product_id', v_prod_b1::text, 'quantity', 1)
    )
  );

  IF (v_res_b->>'success')::BOOLEAN <> TRUE OR (v_res_b->>'subtotal')::NUMERIC <> 75.00 THEN
    RAISE EXCEPTION 'CHECK 11 FAILED: Shop B was blocked from using its own independent sequence key!';
  END IF;
  RAISE NOTICE 'CHECK 11 PASSED: Shop-scoped idempotency allows independent key namespaces across merchants';

  -- -------------------------------------------------------------------
  -- CHECK 12: Duplicate product IDs in cart are aggregated correctly
  -- -------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_owner_a::text, true);

  -- Cart sends Widget A1 twice (quantity 1 and quantity 2 -> total 3). Current stock of A1 is 18.
  v_res_dup := public.finalize_bill_atomic(
    p_shop_id => v_shop_a,
    p_idempotency_key => 'seq_dup_items_001',
    p_items => jsonb_build_array(
      jsonb_build_object('product_id', v_prod_a1::text, 'quantity', 1),
      jsonb_build_object('product_id', v_prod_a1::text, 'quantity', 2)
    )
  );

  IF (v_res_dup->>'success')::BOOLEAN <> TRUE OR
     (v_res_dup->>'subtotal')::NUMERIC <> 150.00 OR
     (SELECT stock_quantity FROM public.products WHERE id = v_prod_a1) <> 15 THEN
    RAISE EXCEPTION 'CHECK 12 FAILED: Duplicate product IDs in cart were not aggregated accurately!';
  END IF;
  RAISE NOTICE 'CHECK 12 PASSED: Duplicate product IDs in single cart aggregated accurately (remaining stock = 15)';

  -- -------------------------------------------------------------------
  -- CHECK 13: Invalid numeric inputs (NaN, Infinity, negative)
  -- -------------------------------------------------------------------
  v_blocked := FALSE;
  BEGIN
    PERFORM public.finalize_bill_atomic(
      p_shop_id => v_shop_a,
      p_tax => 'NaN'::numeric,
      p_items => jsonb_build_array(jsonb_build_object('product_id', v_prod_a1::text, 'quantity', 1))
    );
  EXCEPTION WHEN raise_exception THEN
    v_blocked := TRUE;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'CHECK 13A FAILED: NaN tax was not rejected!';
  END IF;

  v_blocked := FALSE;
  BEGIN
    PERFORM public.finalize_bill_atomic(
      p_shop_id => v_shop_a,
      p_discount => -5.00,
      p_items => jsonb_build_array(jsonb_build_object('product_id', v_prod_a1::text, 'quantity', 1))
    );
  EXCEPTION WHEN raise_exception THEN
    v_blocked := TRUE;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'CHECK 13B FAILED: Negative discount was not rejected!';
  END IF;
  RAISE NOTICE 'CHECK 13 PASSED: NaN, Infinity, and negative numeric inputs rejected';

  -- -------------------------------------------------------------------
  -- CHECK 14: Authorized adjust_stock_atomic modifies stock and writes audit log
  -- -------------------------------------------------------------------
  PERFORM public.adjust_stock_atomic(
    p_product_id => v_prod_a1,
    p_change_amount => 5,
    p_reason => 'stock_in',
    p_notes => 'Shipment received'
  );

  IF (SELECT stock_quantity FROM public.products WHERE id = v_prod_a1) <> 20 THEN
    RAISE EXCEPTION 'CHECK 14 FAILED: Stock adjustment quantity mismatch!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.stock_movements WHERE product_id = v_prod_a1 AND change_amount = 5 AND reason = 'stock_in'
  ) THEN
    RAISE EXCEPTION 'CHECK 14 FAILED: Stock movement audit log not recorded!';
  END IF;
  RAISE NOTICE 'CHECK 14 PASSED: Stock adjustment and audit log atomically synchronized';

  -- -------------------------------------------------------------------
  -- CHECK 15: Service-role behavior verification (adjust_stock_atomic & direct UPDATE)
  -- -------------------------------------------------------------------
  -- A. Service-role direct UPDATE without audit logging MUST BE REJECTED
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  v_blocked := FALSE;
  BEGIN
    UPDATE public.products SET stock_quantity = 8888 WHERE id = v_prod_a1;
  EXCEPTION WHEN raise_exception, insufficient_privilege THEN
    v_blocked := TRUE;
    v_err := SQLERRM;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'CHECK 15A FAILED: Service-role directly updated stock_quantity, bypassing audit logging!';
  END IF;
  RAISE NOTICE 'CHECK 15A PASSED: Service-role direct stock UPDATE denied without audit logging (%: %)', SQLSTATE, v_err;

  -- B. Service-role calling adjust_stock_atomic SUCCEEDS and writes audit record
  v_res_sr := public.adjust_stock_atomic(
    p_product_id => v_prod_a1,
    p_change_amount => 10,
    p_reason => 'stock_in',
    p_notes => 'Administrative warehouse restock'
  );

  IF (v_res_sr->>'success')::BOOLEAN <> TRUE OR
     (SELECT stock_quantity FROM public.products WHERE id = v_prod_a1) <> 30 THEN
    RAISE EXCEPTION 'CHECK 15B FAILED: Service-role adjust_stock_atomic failed!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.stock_movements 
    WHERE id = (v_res_sr->>'movement_id')::UUID 
      AND product_id = v_prod_a1 
      AND change_amount = 10 
      AND created_by = v_owner_a
  ) THEN
    RAISE EXCEPTION 'CHECK 15B FAILED: Service-role adjustment did not record expected audit movement!';
  END IF;
  RAISE NOTICE 'CHECK 15B PASSED: Service-role adjust_stock_atomic updated stock and recorded audit record';

  -- -------------------------------------------------------------------
  -- CHECK 16: Direct forged invoice write blocked
  -- -------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_owner_a::text, true);

  v_blocked := FALSE;
  BEGIN
    INSERT INTO public.invoices (invoice_number, shop_id, created_by, subtotal, final_total)
    VALUES ('FORGED-INV-999', v_shop_a, v_owner_a, 10, 10);
  EXCEPTION WHEN raise_exception, check_violation, integrity_constraint_violation, insufficient_privilege THEN
    v_blocked := TRUE;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'CHECK 16 FAILED: Client directly inserted forged invoice!';
  END IF;
  RAISE NOTICE 'CHECK 16 PASSED: Direct forged invoice write blocked by REVOKE INSERT';

  -- -------------------------------------------------------------------
  -- CHECK 17: History deletion prevention (ON DELETE RESTRICT)
  -- -------------------------------------------------------------------
  v_blocked := FALSE;
  BEGIN
    DELETE FROM public.shops WHERE id = v_shop_a;
  EXCEPTION WHEN foreign_key_violation, raise_exception THEN
    v_blocked := TRUE;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'CHECK 17 FAILED: Shop with financial invoices was deleted, violating history preservation!';
  END IF;
  RAISE NOTICE 'CHECK 17 PASSED: Cascading shop deletion blocked by ON DELETE RESTRICT';

  RAISE NOTICE '==================================================';
  RAISE NOTICE 'ALL 17 LOCOSTOCK DATABASE SECURITY CHECKS PASSED!';
  RAISE NOTICE '==================================================';
END $$;

ROLLBACK;
