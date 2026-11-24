-- =======================================================================
-- LOCOSTOCK PREFLIGHT SCHEMA, PRIVILEGES & DATA INTEGRITY CHECKS
-- =======================================================================
-- INSTRUCTIONS: Run this script in the Supabase SQL Editor BEFORE applying
-- supabase_schema.sql. If any check returns rows marked "ACTION REQUIRED",
-- resolve those data issues before proceeding with the migration.
--
-- IMPORTANT POSTGRESQL DEFAULT BEHAVIOR NOTE:
-- Changing a column default via `ALTER TABLE ... ALTER COLUMN ... SET DEFAULT ...`
-- affects ONLY new rows inserted in the future. Existing rows are NOT updated.
-- If any existing shops have `is_verified = NULL`, they must be explicitly updated.

-- -----------------------------------------------------------------------
-- 1. Check for Profiles Missing Contact Info (Blocks profiles_contact_check)
-- -----------------------------------------------------------------------
SELECT 
  id, 
  full_name, 
  created_at,
  'ACTION REQUIRED: Profile has neither email nor phone. Must populate email or phone before constraint can be applied.' AS issue
FROM public.profiles 
WHERE email IS NULL AND phone IS NULL;

-- -----------------------------------------------------------------------
-- 2. Check for Duplicate Idempotency Keys per Shop
-- -----------------------------------------------------------------------
SELECT 
  shop_id, 
  idempotency_key, 
  COUNT(*) AS collision_count,
  'ACTION REQUIRED: Duplicate (shop_id, idempotency_key) detected. Manual deduplication required.' AS issue
FROM public.invoices 
WHERE idempotency_key IS NOT NULL 
GROUP BY shop_id, idempotency_key 
HAVING COUNT(*) > 1;

-- -----------------------------------------------------------------------
-- 3. Check for Orphaned Invoices (Missing Shop or Creator)
-- -----------------------------------------------------------------------
SELECT 
  inv.id AS invoice_id, 
  inv.invoice_number, 
  inv.shop_id,
  'ACTION REQUIRED: Invoice references non-existent shop. Foreign key migration will fail.' AS issue
FROM public.invoices inv
LEFT JOIN public.shops s ON inv.shop_id = s.id
WHERE s.id IS NULL;

SELECT 
  inv.id AS invoice_id, 
  inv.invoice_number, 
  inv.created_by,
  'ACTION REQUIRED: Invoice references non-existent profile. Foreign key migration will fail.' AS issue
FROM public.invoices inv
LEFT JOIN public.profiles p ON inv.created_by = p.id
WHERE p.id IS NULL;

-- -----------------------------------------------------------------------
-- 4. Check for Orphaned Stock Movements (Missing Shop, Creator, or Product)
-- -----------------------------------------------------------------------
SELECT 
  sm.id AS movement_id, 
  sm.shop_id,
  'ACTION REQUIRED: Stock movement references non-existent shop. Foreign key migration will fail.' AS issue
FROM public.stock_movements sm
LEFT JOIN public.shops s ON sm.shop_id = s.id
WHERE s.id IS NULL;

SELECT 
  sm.id AS movement_id, 
  sm.created_by,
  'ACTION REQUIRED: Stock movement references non-existent profile. Foreign key migration will fail.' AS issue
FROM public.stock_movements sm
LEFT JOIN public.profiles p ON sm.created_by = p.id
WHERE p.id IS NULL;

-- -----------------------------------------------------------------------
-- 5. Check for Out-of-Bounds Coordinates in Existing Shops
-- -----------------------------------------------------------------------
SELECT 
  id, 
  name, 
  latitude, 
  longitude,
  'ACTION REQUIRED: Coordinates outside valid GPS bounds (-90 to +90 lat, -180 to +180 lon).' AS issue
FROM public.shops 
WHERE latitude IS NULL OR longitude IS NULL 
   OR latitude < -90.0 OR latitude > 90.0 
   OR longitude < -180.0 OR longitude > 180.0;

-- -----------------------------------------------------------------------
-- 6. Check for Shops with NULL Verification or Archival Status
-- -----------------------------------------------------------------------
SELECT 
  id, 
  name, 
  is_verified,
  is_archived,
  created_at,
  'ADVISORY: Shop has NULL verification or archival status. Will need: UPDATE public.shops SET is_verified = FALSE WHERE is_verified IS NULL;' AS issue
FROM public.shops 
WHERE is_verified IS NULL OR is_archived IS NULL;

-- -----------------------------------------------------------------------
-- 7. Audit Table-Level Grants on Products (Must NOT have UPDATE/INSERT for authenticated/anon/PUBLIC)
-- -----------------------------------------------------------------------
SELECT 
  grantee, 
  table_schema, 
  table_name, 
  privilege_type,
  CASE 
    WHEN privilege_type IN ('INSERT', 'UPDATE') AND grantee IN ('authenticated', 'anon', 'PUBLIC') 
    THEN 'ACTION REQUIRED: Table-level ' || privilege_type || ' must be revoked on public.products'
    ELSE 'OK'
  END AS status
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'products'
  AND grantee IN ('authenticated', 'anon', 'PUBLIC');

-- -----------------------------------------------------------------------
-- 8. Audit Column-Level Grants on Products (Verify stock_quantity is NOT granted)
-- -----------------------------------------------------------------------
SELECT 
  grantee, 
  table_name, 
  column_name, 
  privilege_type,
  CASE 
    WHEN column_name = 'stock_quantity' AND privilege_type IN ('INSERT', 'UPDATE') AND grantee IN ('authenticated', 'anon', 'PUBLIC')
    THEN 'CRITICAL VULNERABILITY: stock_quantity must NOT be granted to ' || grantee
    ELSE 'OK (Permitted Column Privilege)'
  END AS audit_status
FROM information_schema.role_column_grants
WHERE table_schema = 'public' 
  AND table_name = 'products'
  AND grantee IN ('authenticated', 'anon', 'PUBLIC')
ORDER BY column_name, privilege_type;

-- -----------------------------------------------------------------------
-- 9. Report Current Foreign Key Delete Rules
-- -----------------------------------------------------------------------
SELECT 
  cl_from.relname AS table_name,
  con.conname AS constraint_name,
  att.attname AS constrained_column,
  cl_to.relname AS referenced_table,
  CASE con.confdeltype 
    WHEN 'r' THEN 'RESTRICT (Compliant - will be preserved)'
    WHEN 'c' THEN 'CASCADE (Will be safely migrated to RESTRICT/SET NULL)'
    WHEN 'a' THEN 'NO ACTION (Will be safely migrated to RESTRICT/SET NULL)'
    WHEN 'n' THEN 'SET NULL'
    ELSE con.confdeltype::text
  END AS current_rule
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class cl_from ON cl_from.oid = con.conrelid
JOIN pg_catalog.pg_namespace ns_from ON ns_from.oid = cl_from.relnamespace
JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
JOIN pg_catalog.pg_class cl_to ON cl_to.oid = con.confrelid
JOIN pg_catalog.pg_namespace ns_to ON ns_to.oid = cl_to.relnamespace
WHERE con.contype = 'f'
  AND cardinality(con.conkey) = 1
  AND ns_from.nspname = 'public'
  AND cl_from.relname IN ('invoices', 'stock_movements', 'invoice_items')
ORDER BY cl_from.relname, att.attname;

-- -----------------------------------------------------------------------
-- 10. Report Existing Legacy Triggers on Target Tables
-- -----------------------------------------------------------------------
SELECT 
  event_object_table AS table_name,
  trigger_name,
  action_timing,
  event_manipulation AS event,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('tr_handle_shop_verification', 'handle_shop_verification')
ORDER BY event_object_table, trigger_name;

-- -----------------------------------------------------------------------
-- 11. Report Existing RLS Policies on Target Tables
-- -----------------------------------------------------------------------
SELECT 
  tablename, 
  policyname, 
  cmd, 
  roles
FROM pg_catalog.pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'shops', 'products', 'invoices', 'invoice_items', 'stock_movements')
ORDER BY tablename, cmd;
