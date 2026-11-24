-- =======================================================================
-- LOCOSTOCK SUPABASE SQL MIGRATION & SECURITY SCHEMA (PRODUCTION HARDENED)
-- =======================================================================
-- Note: Do NOT execute this script against production without prior testing.
-- Run preflight_checks.sql before applying this script to an existing database.

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. User Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'shopkeeper')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Shops Table
CREATE TABLE IF NOT EXISTS public.shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  address_line TEXT NOT NULL,
  locality TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  business_hours TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Shop-Specific Product Inventory Table
-- Note: Direct client UPDATE and INSERT on stock_quantity are revoked at the column-privilege level.
-- Inventory changes must occur exclusively through finalize_bill_atomic and adjust_stock_atomic.
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  brand TEXT,
  sku TEXT,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  last_inventory_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Invoices Table
-- Note: shop_id and created_by use ON DELETE RESTRICT to preserve immutable financial audit records.
-- Idempotency keys are scoped per shop via composite unique constraint (shop_id, idempotency_key).
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT NOT NULL,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  customer_name TEXT,
  customer_phone TEXT,
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  tax NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  discount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  final_total NUMERIC(10, 2) NOT NULL CHECK (final_total >= 0),
  idempotency_key TEXT,
  request_fingerprint TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number),
  CONSTRAINT invoices_shop_id_idempotency_key_key UNIQUE (shop_id, idempotency_key)
);

-- 6. Invoice Line Items Table
-- Note: product_id allows NULL (ON DELETE SET NULL) so historical line items survive product retirement
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(10, 2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Inventory Movements / Audit Log
-- Note: shop_id and created_by use ON DELETE RESTRICT to guarantee immutable audit logs
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  change_amount INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
  reason TEXT NOT NULL CHECK (reason IN ('sale', 'stock_in', 'damaged', 'return', 'adjustment')),
  reference_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------
-- 8. IDEMPOTENT SCHEMA MIGRATIONS FOR EXISTING DATABASES
-- -----------------------------------------------------------------------
DO $$
DECLARE
  v_fk RECORD;
  v_has_orphans BOOLEAN;
BEGIN
  -- 8.1 Profiles migrations: phone support, nullable email for SMS OTP, contact check
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
  ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;
  ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'customer';

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'profiles_contact_check') THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE email IS NULL AND phone IS NULL) THEN
      ALTER TABLE public.profiles ADD CONSTRAINT profiles_contact_check 
        CHECK (email IS NOT NULL OR phone IS NOT NULL);
    ELSE
      RAISE NOTICE 'SKIPPED profiles_contact_check: rows exist with both email and phone NULL. Run preflight_checks.sql to remediate.';
    END IF;
  END IF;

  -- 8.2 Shops migrations: default is_verified to FALSE, add is_archived, coordinate bounds
  ALTER TABLE public.shops ALTER COLUMN is_verified SET DEFAULT FALSE;
  ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'shops_latitude_check') THEN
    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE latitude < -90.0 OR latitude > 90.0) THEN
      ALTER TABLE public.shops ADD CONSTRAINT shops_latitude_check CHECK (latitude BETWEEN -90.0 AND 90.0);
    ELSE
      RAISE NOTICE 'SKIPPED shops_latitude_check: invalid latitudes found in existing rows.';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'shops_longitude_check') THEN
    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE longitude < -180.0 OR longitude > 180.0) THEN
      ALTER TABLE public.shops ADD CONSTRAINT shops_longitude_check CHECK (longitude BETWEEN -180.0 AND 180.0);
    ELSE
      RAISE NOTICE 'SKIPPED shops_longitude_check: invalid longitudes found in existing rows.';
    END IF;
  END IF;

  -- 8.3 Products migrations: add is_archived
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

  -- 8.4 Invoices migrations: request_fingerprint, replace legacy global unique with shop-scoped unique
  ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;

  -- Ensure invoice_number unique constraint exists with standard name
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'invoices_invoice_number_unique') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'invoices_invoice_number_key') THEN
      ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number);
    END IF;
  END IF;

  -- Drop legacy global unique constraint if present
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'invoices_idempotency_key_key') THEN
    ALTER TABLE public.invoices DROP CONSTRAINT invoices_idempotency_key_key;
  END IF;

  -- Add shop-scoped composite unique constraint
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'invoices_shop_id_idempotency_key_key') THEN
    IF NOT EXISTS (
      SELECT shop_id, idempotency_key FROM public.invoices 
      WHERE idempotency_key IS NOT NULL 
      GROUP BY shop_id, idempotency_key HAVING COUNT(*) > 1
    ) THEN
      ALTER TABLE public.invoices ADD CONSTRAINT invoices_shop_id_idempotency_key_key UNIQUE (shop_id, idempotency_key);
    ELSE
      RAISE NOTICE 'SKIPPED invoices_shop_id_idempotency_key_key: duplicate (shop_id, idempotency_key) detected. Run preflight_checks.sql to remediate.';
    END IF;
  END IF;

  -- 8.5 Nullable product IDs on historical tables
  ALTER TABLE public.invoice_items ALTER COLUMN product_id DROP NOT NULL;
  ALTER TABLE public.stock_movements ALTER COLUMN product_id DROP NOT NULL;

  -- 8.6 Foreign Key Migrations (Safe Validation Before Replacement, Never Touching Composite Keys)

  -- 8.6.1 Invoices -> Shops (shop_id) -> ON DELETE RESTRICT
  SELECT EXISTS (
    SELECT 1 FROM public.invoices inv LEFT JOIN public.shops s ON inv.shop_id = s.id WHERE s.id IS NULL
  ) INTO v_has_orphans;

  IF v_has_orphans THEN
    RAISE NOTICE 'SKIPPED invoices_shop_id_fkey: orphan invoices found referencing deleted shops. Existing constraint kept.';
  ELSE
    FOR v_fk IN
      SELECT con.conname, con.confdeltype
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class cl_from ON cl_from.oid = con.conrelid
      JOIN pg_catalog.pg_namespace ns_from ON ns_from.oid = cl_from.relnamespace
      JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      JOIN pg_catalog.pg_class cl_to ON cl_to.oid = con.confrelid
      JOIN pg_catalog.pg_namespace ns_to ON ns_to.oid = cl_to.relnamespace
      JOIN pg_catalog.pg_attribute ref_att ON ref_att.attrelid = con.confrelid AND ref_att.attnum = con.confkey[1]
      WHERE con.contype = 'f' 
        AND cardinality(con.conkey) = 1
        AND cardinality(con.confkey) = 1
        AND ns_from.nspname = 'public' 
        AND cl_from.relname = 'invoices' 
        AND att.attname = 'shop_id'
        AND ns_to.nspname = 'public' 
        AND cl_to.relname = 'shops'
        AND ref_att.attname = 'id'
    LOOP
      IF v_fk.confdeltype <> 'r' THEN
        EXECUTE format('ALTER TABLE public.invoices DROP CONSTRAINT %I', v_fk.conname);
        ALTER TABLE public.invoices ADD CONSTRAINT invoices_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE RESTRICT;
      END IF;
    END LOOP;

    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class cl_from ON cl_from.oid = con.conrelid
      JOIN pg_catalog.pg_namespace ns_from ON ns_from.oid = cl_from.relnamespace
      JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      JOIN pg_catalog.pg_class cl_to ON cl_to.oid = con.confrelid
      JOIN pg_catalog.pg_namespace ns_to ON ns_to.oid = cl_to.relnamespace
      WHERE con.contype = 'f' 
        AND cardinality(con.conkey) = 1
        AND ns_from.nspname = 'public' 
        AND cl_from.relname = 'invoices' 
        AND att.attname = 'shop_id'
        AND ns_to.nspname = 'public' 
        AND cl_to.relname = 'shops' 
        AND con.confdeltype = 'r'
    ) THEN
      ALTER TABLE public.invoices ADD CONSTRAINT invoices_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE RESTRICT;
    END IF;
  END IF;

  -- 8.6.2 Invoices -> Profiles (created_by) -> ON DELETE RESTRICT
  SELECT EXISTS (
    SELECT 1 FROM public.invoices inv LEFT JOIN public.profiles p ON inv.created_by = p.id WHERE p.id IS NULL
  ) INTO v_has_orphans;

  IF v_has_orphans THEN
    RAISE NOTICE 'SKIPPED invoices_created_by_fkey: orphan invoices found referencing deleted profiles. Existing constraint kept.';
  ELSE
    FOR v_fk IN
      SELECT con.conname, con.confdeltype
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class cl_from ON cl_from.oid = con.conrelid
      JOIN pg_catalog.pg_namespace ns_from ON ns_from.oid = cl_from.relnamespace
      JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      JOIN pg_catalog.pg_class cl_to ON cl_to.oid = con.confrelid
      JOIN pg_catalog.pg_namespace ns_to ON ns_to.oid = cl_to.relnamespace
      JOIN pg_catalog.pg_attribute ref_att ON ref_att.attrelid = con.confrelid AND ref_att.attnum = con.confkey[1]
      WHERE con.contype = 'f' 
        AND cardinality(con.conkey) = 1
        AND cardinality(con.confkey) = 1
        AND ns_from.nspname = 'public' 
        AND cl_from.relname = 'invoices' 
        AND att.attname = 'created_by'
        AND ns_to.nspname = 'public' 
        AND cl_to.relname = 'profiles'
        AND ref_att.attname = 'id'
    LOOP
      IF v_fk.confdeltype <> 'r' THEN
        EXECUTE format('ALTER TABLE public.invoices DROP CONSTRAINT %I', v_fk.conname);
        ALTER TABLE public.invoices ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;
      END IF;
    END LOOP;

    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class cl_from ON cl_from.oid = con.conrelid
      JOIN pg_catalog.pg_namespace ns_from ON ns_from.oid = cl_from.relnamespace
      JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      JOIN pg_catalog.pg_class cl_to ON cl_to.oid = con.confrelid
      JOIN pg_catalog.pg_namespace ns_to ON ns_to.oid = cl_to.relnamespace
      WHERE con.contype = 'f' 
        AND cardinality(con.conkey) = 1
        AND ns_from.nspname = 'public' 
        AND cl_from.relname = 'invoices' 
        AND att.attname = 'created_by'
        AND ns_to.nspname = 'public' 
        AND cl_to.relname = 'profiles' 
        AND con.confdeltype = 'r'
    ) THEN
      ALTER TABLE public.invoices ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;
    END IF;
  END IF;

  -- 8.6.3 Stock Movements -> Shops (shop_id) -> ON DELETE RESTRICT
  SELECT EXISTS (
    SELECT 1 FROM public.stock_movements sm LEFT JOIN public.shops s ON sm.shop_id = s.id WHERE s.id IS NULL
  ) INTO v_has_orphans;

  IF v_has_orphans THEN
    RAISE NOTICE 'SKIPPED stock_movements_shop_id_fkey: orphan stock movements found referencing deleted shops. Existing constraint kept.';
  ELSE
    FOR v_fk IN
      SELECT con.conname, con.confdeltype
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class cl_from ON cl_from.oid = con.conrelid
      JOIN pg_catalog.pg_namespace ns_from ON ns_from.oid = cl_from.relnamespace
      JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      JOIN pg_catalog.pg_class cl_to ON cl_to.oid = con.confrelid
      JOIN pg_catalog.pg_namespace ns_to ON ns_to.oid = cl_to.relnamespace
      JOIN pg_catalog.pg_attribute ref_att ON ref_att.attrelid = con.confrelid AND ref_att.attnum = con.confkey[1]
      WHERE con.contype = 'f' 
        AND cardinality(con.conkey) = 1
        AND cardinality(con.confkey) = 1
        AND ns_from.nspname = 'public' 
        AND cl_from.relname = 'stock_movements' 
        AND att.attname = 'shop_id'
        AND ns_to.nspname = 'public' 
        AND cl_to.relname = 'shops'
        AND ref_att.attname = 'id'
    LOOP
      IF v_fk.confdeltype <> 'r' THEN
        EXECUTE format('ALTER TABLE public.stock_movements DROP CONSTRAINT %I', v_fk.conname);
        ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE RESTRICT;
      END IF;
    END LOOP;

    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class cl_from ON cl_from.oid = con.conrelid
      JOIN pg_catalog.pg_namespace ns_from ON ns_from.oid = cl_from.relnamespace
      JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      JOIN pg_catalog.pg_class cl_to ON cl_to.oid = con.confrelid
      JOIN pg_catalog.pg_namespace ns_to ON ns_to.oid = cl_to.relnamespace
      WHERE con.contype = 'f' 
        AND cardinality(con.conkey) = 1
        AND ns_from.nspname = 'public' 
        AND cl_from.relname = 'stock_movements' 
        AND att.attname = 'shop_id'
        AND ns_to.nspname = 'public' 
        AND cl_to.relname = 'shops' 
        AND con.confdeltype = 'r'
    ) THEN
      ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE RESTRICT;
    END IF;
  END IF;

  -- 8.6.4 Stock Movements -> Profiles (created_by) -> ON DELETE RESTRICT
  SELECT EXISTS (
    SELECT 1 FROM public.stock_movements sm LEFT JOIN public.profiles p ON sm.created_by = p.id WHERE p.id IS NULL
  ) INTO v_has_orphans;

  IF v_has_orphans THEN
    RAISE NOTICE 'SKIPPED stock_movements_created_by_fkey: orphan stock movements found referencing deleted profiles. Existing constraint kept.';
  ELSE
    FOR v_fk IN
      SELECT con.conname, con.confdeltype
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class cl_from ON cl_from.oid = con.conrelid
      JOIN pg_catalog.pg_namespace ns_from ON ns_from.oid = cl_from.relnamespace
      JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      JOIN pg_catalog.pg_class cl_to ON cl_to.oid = con.confrelid
      JOIN pg_catalog.pg_namespace ns_to ON ns_to.oid = cl_to.relnamespace
      JOIN pg_catalog.pg_attribute ref_att ON ref_att.attrelid = con.confrelid AND ref_att.attnum = con.confkey[1]
      WHERE con.contype = 'f' 
        AND cardinality(con.conkey) = 1
        AND cardinality(con.confkey) = 1
        AND ns_from.nspname = 'public' 
        AND cl_from.relname = 'stock_movements' 
        AND att.attname = 'created_by'
        AND ns_to.nspname = 'public' 
        AND cl_to.relname = 'profiles'
        AND ref_att.attname = 'id'
    LOOP
      IF v_fk.confdeltype <> 'r' THEN
        EXECUTE format('ALTER TABLE public.stock_movements DROP CONSTRAINT %I', v_fk.conname);
        ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;
      END IF;
    END LOOP;

    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class cl_from ON cl_from.oid = con.conrelid
      JOIN pg_catalog.pg_namespace ns_from ON ns_from.oid = cl_from.relnamespace
      JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      JOIN pg_catalog.pg_class cl_to ON cl_to.oid = con.confrelid
      JOIN pg_catalog.pg_namespace ns_to ON ns_to.oid = cl_to.relnamespace
      WHERE con.contype = 'f' 
        AND cardinality(con.conkey) = 1
        AND ns_from.nspname = 'public' 
        AND cl_from.relname = 'stock_movements' 
        AND att.attname = 'created_by'
        AND ns_to.nspname = 'public' 
        AND cl_to.relname = 'profiles' 
        AND con.confdeltype = 'r'
    ) THEN
      ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;
    END IF;
  END IF;

  -- 8.6.5 Invoice Items -> Products (product_id) -> ON DELETE SET NULL
  FOR v_fk IN
    SELECT con.conname, con.confdeltype
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class cl_from ON cl_from.oid = con.conrelid
    JOIN pg_catalog.pg_namespace ns_from ON ns_from.oid = cl_from.relnamespace
    JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    JOIN pg_catalog.pg_class cl_to ON cl_to.oid = con.confrelid
    JOIN pg_catalog.pg_namespace ns_to ON ns_to.oid = cl_to.relnamespace
    JOIN pg_catalog.pg_attribute ref_att ON ref_att.attrelid = con.confrelid AND ref_att.attnum = con.confkey[1]
    WHERE con.contype = 'f' 
      AND cardinality(con.conkey) = 1
      AND cardinality(con.confkey) = 1
      AND ns_from.nspname = 'public' 
      AND cl_from.relname = 'invoice_items' 
      AND att.attname = 'product_id'
      AND ns_to.nspname = 'public' 
      AND cl_to.relname = 'products' 
      AND ref_att.attname = 'id'
  LOOP
    IF v_fk.confdeltype <> 'n' THEN
      EXECUTE format('ALTER TABLE public.invoice_items DROP CONSTRAINT %I', v_fk.conname);
      ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class cl_from ON cl_from.oid = con.conrelid
    JOIN pg_catalog.pg_namespace ns_from ON ns_from.oid = cl_from.relnamespace
    JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    JOIN pg_catalog.pg_class cl_to ON cl_to.oid = con.confrelid
    JOIN pg_catalog.pg_namespace ns_to ON ns_to.oid = cl_to.relnamespace
    WHERE con.contype = 'f' 
      AND cardinality(con.conkey) = 1
      AND ns_from.nspname = 'public' 
      AND cl_from.relname = 'invoice_items' 
      AND att.attname = 'product_id'
      AND ns_to.nspname = 'public' 
      AND cl_to.relname = 'products' 
      AND con.confdeltype = 'n'
  ) THEN
    ALTER TABLE public.invoice_items ADD CONSTRAINT invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;

  -- 8.6.6 Stock Movements -> Products (product_id) -> ON DELETE SET NULL
  FOR v_fk IN
    SELECT con.conname, con.confdeltype
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class cl_from ON cl_from.oid = con.conrelid
    JOIN pg_catalog.pg_namespace ns_from ON ns_from.oid = cl_from.relnamespace
    JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    JOIN pg_catalog.pg_class cl_to ON cl_to.oid = con.confrelid
    JOIN pg_catalog.pg_namespace ns_to ON ns_to.oid = cl_to.relnamespace
    JOIN pg_catalog.pg_attribute ref_att ON ref_att.attrelid = con.confrelid AND ref_att.attnum = con.confkey[1]
    WHERE con.contype = 'f' 
      AND cardinality(con.conkey) = 1
      AND cardinality(con.confkey) = 1
      AND ns_from.nspname = 'public' 
      AND cl_from.relname = 'stock_movements' 
      AND att.attname = 'product_id'
      AND ns_to.nspname = 'public' 
      AND cl_to.relname = 'products' 
      AND ref_att.attname = 'id'
  LOOP
    IF v_fk.confdeltype <> 'n' THEN
      EXECUTE format('ALTER TABLE public.stock_movements DROP CONSTRAINT %I', v_fk.conname);
      ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class cl_from ON cl_from.oid = con.conrelid
    JOIN pg_catalog.pg_namespace ns_from ON ns_from.oid = cl_from.relnamespace
    JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    JOIN pg_catalog.pg_class cl_to ON cl_to.oid = con.confrelid
    JOIN pg_catalog.pg_namespace ns_to ON ns_to.oid = cl_to.relnamespace
    WHERE con.contype = 'f' 
      AND cardinality(con.conkey) = 1
      AND ns_from.nspname = 'public' 
      AND cl_from.relname = 'stock_movements' 
      AND att.attname = 'product_id'
      AND ns_to.nspname = 'public' 
      AND cl_to.relname = 'products' 
      AND con.confdeltype = 'n'
  ) THEN
    ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;

  -- Clean up legacy triggers/functions if present
  DROP TRIGGER IF EXISTS tr_handle_shop_verification ON public.shops;
  DROP FUNCTION IF EXISTS public.handle_shop_verification();
END $$;

-- -----------------------------------------------------------------------
-- 9. PERFORMANCE & SPATIAL INDEXES
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_shop_id ON public.products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_discovery ON public.products(is_active, is_archived);
CREATE INDEX IF NOT EXISTS idx_shops_coords ON public.shops(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_shops_owner_id ON public.shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_shops_status ON public.shops(is_verified, is_archived);
CREATE INDEX IF NOT EXISTS idx_invoices_shop_id ON public.invoices(shop_id);
CREATE INDEX IF NOT EXISTS idx_invoices_shop_idemp ON public.invoices(shop_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_shop_id ON public.stock_movements(shop_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);

-- -----------------------------------------------------------------------
-- 10. ATOMIC TRANSACTIONAL BILLING FUNCTION (PRODUCTION HARDENED)
-- -----------------------------------------------------------------------
-- IDEMPOTENCY & TAX POLICY DOCUMENTATION:
-- 1. Scoping: Idempotency keys are scoped strictly per shop (shop_id, idempotency_key).
--    Two different merchants may independently bill using identical local sequence keys without conflict.
-- 2. Request Fingerprint: A SHA-256 digest covers shop_id, authenticated user_id, trimmed customer
--    name/phone, aggregated sorted product IDs and quantities, tax, and discount.
--    Excluded fields: client-supplied subtotal/final_total (recalculated authoritatively from DB prices)
--    and submission timestamps (which naturally differ across retries).
-- 3. Overflow Protection: All cart quantities are aggregated using PostgreSQL arbitrary-precision
--    NUMERIC before validation. Bounded totals (<= 100,000 units) are verified prior to INT conversion.
-- 4. Legacy Replays: Invoices with NULL request_fingerprint cannot be verified and are rejected with
--    an explicit error requiring a fresh idempotency key.
-- 5. Tax Policy: In LocoStock's in-store POS checkout model, the shopkeeper specifies the applicable tax
--    amount or percentage for the transaction. The server validates that tax is non-null, non-negative,
--    finite (not NaN, Infinity, or -Infinity), and does not exceed the computed subtotal (100% ceiling).
--    Subtotal is computed strictly from authoritative database product prices.
CREATE OR REPLACE FUNCTION public.finalize_bill_atomic(
  p_shop_id UUID,
  p_user_id UUID DEFAULT NULL, -- Ignored in favor of verified auth.uid()
  p_customer_name TEXT DEFAULT '',
  p_customer_phone TEXT DEFAULT '',
  p_subtotal NUMERIC DEFAULT 0, -- Re-calculated on server from trusted DB prices
  p_tax NUMERIC DEFAULT 0,
  p_discount NUMERIC DEFAULT 0,
  p_final_total NUMERIC DEFAULT 0, -- Re-calculated on server from trusted DB prices
  p_idempotency_key TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID;
  v_user_role TEXT;
  v_shop_name TEXT;
  v_is_verified BOOLEAN;
  v_is_archived BOOLEAN;
  v_idempotency_key TEXT;
  v_payload_fingerprint TEXT;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_existing_inv RECORD;
  v_item RECORD;
  v_json_item JSONB;
  v_prod_id UUID;
  v_qty INT;
  v_db_price NUMERIC(10, 2);
  v_current_stock INT;
  v_is_active BOOLEAN;
  v_prod_is_archived BOOLEAN;
  v_prod_name TEXT;
  v_line_total NUMERIC(10, 2);
  v_calc_subtotal NUMERIC(10, 2) := 0;
  v_calc_final_total NUMERIC(10, 2) := 0;
  v_tax NUMERIC(10, 2);
  v_discount NUMERIC(10, 2);
  v_attempts INT := 0;
  v_inserted BOOLEAN := false;
  v_con_name TEXT;
BEGIN
  -- 1. Derive acting user from auth.uid()
  v_auth_user_id := auth.uid();
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: An active authenticated session is required to bill transactions';
  END IF;

  -- 2. Verify acting user is the registered owner of the shop AND shop is verified & active
  SELECT name, is_verified, is_archived 
  INTO v_shop_name, v_is_verified, v_is_archived 
  FROM public.shops 
  WHERE id = p_shop_id AND owner_id = v_auth_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized: User % is not the authorized owner of shop %', v_auth_user_id, p_shop_id;
  END IF;

  IF v_is_archived THEN
    RAISE EXCEPTION 'Forbidden: Shop "%" is archived. Billing is disabled for archived shops.', v_shop_name;
  END IF;

  IF NOT v_is_verified THEN
    RAISE EXCEPTION 'Forbidden: Shop "%" is pending administrative verification. Billing is restricted to verified shops.', v_shop_name;
  END IF;

  -- 3. Verify authorized shopkeeper role
  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_auth_user_id;
  IF v_user_role IS DISTINCT FROM 'shopkeeper' THEN
    RAISE EXCEPTION 'Forbidden: User does not possess the authorized shopkeeper role to issue bills';
  END IF;

  -- 4. Normalize and validate idempotency key (reject whitespace-only, convert to NULL)
  v_idempotency_key := NULLIF(trim(p_idempotency_key), '');
  IF p_idempotency_key IS NOT NULL AND v_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Bad request: Idempotency key cannot be whitespace-only';
  END IF;

  IF v_idempotency_key IS NOT NULL AND length(v_idempotency_key) > 255 THEN
    RAISE EXCEPTION 'Bad request: Idempotency key exceeds maximum length of 255 characters';
  END IF;

  -- 5. Validate JSON payload structure, array bounds, and item formats
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Bad request: items must be a non-empty JSON array';
  END IF;

  IF jsonb_array_length(p_items) > 200 THEN
    RAISE EXCEPTION 'Bad request: items array exceeds maximum limit of 200 items per invoice';
  END IF;

  FOR v_json_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_json_item) <> 'object' THEN
      RAISE EXCEPTION 'Bad request: each item in items array must be an object';
    END IF;

    IF v_json_item->>'product_id' IS NULL OR 
       (v_json_item->>'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Bad request: invalid product_id UUID format: %', COALESCE(v_json_item->>'product_id', 'null');
    END IF;

    -- Strict regex validation: 1 to 5 digits (1 to 99,999) before casting to prevent integer overflow
    IF v_json_item->>'quantity' IS NULL OR (v_json_item->>'quantity') !~ '^[1-9]\d{0,4}$' THEN
      RAISE EXCEPTION 'Bad request: quantity must be a positive integer between 1 and 10,000 units';
    END IF;

    IF (v_json_item->>'quantity')::NUMERIC > 10000 THEN
      RAISE EXCEPTION 'Bad request: quantity % exceeds maximum limit of 10,000 units per line', v_json_item->>'quantity';
    END IF;
  END LOOP;

  -- 6. Explicit numeric validation (Detects NaN, null, non-finite, and negative values in PostgreSQL NUMERIC)
  IF p_tax IS NULL OR p_tax = 'NaN'::numeric OR p_tax = 'Infinity'::numeric OR p_tax = '-Infinity'::numeric OR p_tax < 0 THEN
    RAISE EXCEPTION 'Bad request: Tax amount cannot be null, negative, NaN, or infinite';
  END IF;

  IF p_discount IS NULL OR p_discount = 'NaN'::numeric OR p_discount = 'Infinity'::numeric OR p_discount = '-Infinity'::numeric OR p_discount < 0 THEN
    RAISE EXCEPTION 'Bad request: Discount amount cannot be null, negative, NaN, or infinite';
  END IF;

  v_tax := ROUND(p_tax::NUMERIC, 2);
  v_discount := ROUND(p_discount::NUMERIC, 2);

  -- 7. Compute deterministic payload fingerprint (covers distinct invoice creation inputs on NUMERIC-aggregated items)
  v_payload_fingerprint := encode(
    digest(
      p_shop_id::text || ':' ||
      v_auth_user_id::text || ':' ||
      COALESCE(trim(p_customer_name), '') || ':' ||
      COALESCE(trim(p_customer_phone), '') || ':' ||
      (
        SELECT string_agg((x.product_id::text) || '=' || (x.total_qty::text), ',' ORDER BY x.product_id ASC)
        FROM (
          SELECT (item->>'product_id')::UUID AS product_id, SUM((item->>'quantity')::NUMERIC) AS total_qty
          FROM jsonb_array_elements(p_items) AS item
          GROUP BY (item->>'product_id')::UUID
        ) AS x
      ) || ':' ||
      v_tax::text || ':' ||
      v_discount::text,
      'sha256'
    ),
    'hex'
  );

  -- 8. Safe Shop-Scoped Idempotency with Advisory Lock
  IF v_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('bill:' || p_shop_id::text || ':' || v_idempotency_key));

    -- Search for existing invoice scoped to this shop and key
    SELECT id, invoice_number, shop_id, created_by, subtotal, tax, discount, final_total, request_fingerprint 
    INTO v_existing_inv 
    FROM public.invoices 
    WHERE shop_id = p_shop_id AND idempotency_key = v_idempotency_key;

    IF FOUND THEN
      -- Replay must be requested by the authorized creator
      IF v_existing_inv.created_by <> v_auth_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Idempotent replay requested by a different user';
      END IF;

      -- Explicitly reject legacy invoices with NULL fingerprints (cannot be verified safely)
      IF v_existing_inv.request_fingerprint IS NULL THEN
        RAISE EXCEPTION 'Idempotency verification unavailable: invoice "%" was recorded prior to request fingerprinting. Replay cannot be safely verified; please use a distinct idempotency key.', v_existing_inv.invoice_number;
      END IF;

      -- Reject key reuse with altered payload
      IF v_existing_inv.request_fingerprint <> v_payload_fingerprint THEN
        RAISE EXCEPTION 'Idempotency conflict: key "%" in shop % was previously processed with a different billing payload', v_idempotency_key, p_shop_id;
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_existing_inv.id,
        'invoice_number', v_existing_inv.invoice_number,
        'subtotal', v_existing_inv.subtotal,
        'tax', v_existing_inv.tax,
        'discount', v_existing_inv.discount,
        'final_total', v_existing_inv.final_total,
        'idempotent_replay', true
      );
    END IF;
  END IF;

  -- 9. Aggregate items by product_id in NUMERIC, validate bounds BEFORE INT casting,
  -- lock rows FOR UPDATE in sorted order (deadlock prevention), and calculate subtotal using TRUSTED database prices
  FOR v_item IN 
    SELECT 
      (x->>'product_id')::UUID AS product_id, 
      SUM((x->>'quantity')::NUMERIC) AS total_qty
    FROM jsonb_array_elements(p_items) AS x
    GROUP BY (x->>'product_id')::UUID
    ORDER BY product_id ASC
  LOOP
    v_prod_id := v_item.product_id;

    -- Validate bounds on NUMERIC BEFORE casting to INT to prevent integer overflow
    IF v_item.total_qty <= 0 OR v_item.total_qty > 100000 OR v_item.total_qty <> trunc(v_item.total_qty) THEN
      RAISE EXCEPTION 'Bad request: aggregated quantity for product % must be an integer between 1 and 100,000 units', v_prod_id;
    END IF;

    v_qty := v_item.total_qty::INT;

    SELECT name, stock_quantity, price, is_active, is_archived
    INTO v_prod_name, v_current_stock, v_db_price, v_is_active, v_prod_is_archived
    FROM public.products
    WHERE id = v_prod_id AND shop_id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % does not exist or does not belong to shop %', v_prod_id, p_shop_id;
    END IF;

    IF v_prod_is_archived OR NOT v_is_active THEN
      RAISE EXCEPTION 'Product "%" is inactive or archived and cannot be billed', v_prod_name;
    END IF;

    IF v_current_stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product "%". Available: %, Requested: %', v_prod_name, v_current_stock, v_qty;
    END IF;

    v_line_total := ROUND((v_qty * v_db_price)::NUMERIC, 2);
    v_calc_subtotal := v_calc_subtotal + v_line_total;
  END LOOP;

  -- 10. Validate discount and tax against calculated subtotal
  IF v_discount > v_calc_subtotal THEN
    RAISE EXCEPTION 'Bad request: Discount (%) cannot exceed invoice subtotal (%)', v_discount, v_calc_subtotal;
  END IF;

  IF v_tax > v_calc_subtotal THEN
    RAISE EXCEPTION 'Bad request: Tax amount (%) cannot exceed subtotal (%)', v_tax, v_calc_subtotal;
  END IF;

  v_calc_final_total := ROUND((v_calc_subtotal - v_discount + v_tax)::NUMERIC, 2);

  -- 11. Generate unique invoice number with collision retry protection targeting ONLY invoice_number
  WHILE NOT v_inserted AND v_attempts < 5 LOOP
    v_attempts := v_attempts + 1;
    v_invoice_number := 'INV-' || to_char(NOW(), 'YYMMDD') || '-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));

    BEGIN
      INSERT INTO public.invoices (
        invoice_number, shop_id, created_by, customer_name, customer_phone,
        subtotal, tax, discount, final_total, idempotency_key, request_fingerprint
      ) VALUES (
        v_invoice_number, p_shop_id, v_auth_user_id, p_customer_name, p_customer_phone,
        v_calc_subtotal, v_tax, v_discount, v_calc_final_total, v_idempotency_key, v_payload_fingerprint
      ) RETURNING id INTO v_invoice_id;

      v_inserted := true;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_con_name = CONSTRAINT_NAME;
      IF v_con_name IN ('invoices_invoice_number_unique', 'invoices_invoice_number_key') THEN
        v_inserted := false; -- Retry invoice number collision
      ELSE
        RAISE; -- Re-throw unexpected unique constraint violation (e.g. idempotency collision)
      END IF;
    END;
  END LOOP;

  IF NOT v_inserted THEN
    RAISE EXCEPTION 'Failed to generate unique invoice number after % attempts. Please retry.', v_attempts;
  END IF;

  -- 12. Deduct stock, insert invoice items, and record audit movements (using safe validated NUMERIC quantities)
  FOR v_item IN 
    SELECT 
      (x->>'product_id')::UUID AS product_id, 
      SUM((x->>'quantity')::NUMERIC) AS total_qty
    FROM jsonb_array_elements(p_items) AS x
    GROUP BY (x->>'product_id')::UUID
    ORDER BY product_id ASC
  LOOP
    v_prod_id := v_item.product_id;
    v_qty := v_item.total_qty::INT;

    SELECT name, stock_quantity, price 
    INTO v_prod_name, v_current_stock, v_db_price
    FROM public.products
    WHERE id = v_prod_id AND shop_id = p_shop_id
    FOR UPDATE;

    v_line_total := ROUND((v_qty * v_db_price)::NUMERIC, 2);

    -- Authorize stock mutation in current transaction scope
    PERFORM set_config('locostock.stock_mutation_authorized', 'true', true);

    -- Decrement stock and update inventory freshness timestamp
    UPDATE public.products
    SET stock_quantity = stock_quantity - v_qty,
        last_inventory_update = NOW(),
        updated_at = NOW()
    WHERE id = v_prod_id;

    -- Clear transaction scope token
    PERFORM set_config('locostock.stock_mutation_authorized', 'false', true);

    -- Insert invoice line item
    INSERT INTO public.invoice_items (
      invoice_id, product_id, product_name, quantity, unit_price, line_total
    ) VALUES (
      v_invoice_id, v_prod_id, v_prod_name, v_qty, v_db_price, v_line_total
    );

    -- Insert stock movement audit log
    INSERT INTO public.stock_movements (
      product_id, shop_id, change_amount, quantity_after, reason, reference_invoice_id, created_by, notes
    ) VALUES (
      v_prod_id, p_shop_id, -v_qty, (v_current_stock - v_qty), 'sale', v_invoice_id, v_auth_user_id, 'Billed via invoice ' || v_invoice_number
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'subtotal', v_calc_subtotal,
    'tax', v_tax,
    'discount', v_discount,
    'final_total', v_calc_final_total
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_bill_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_bill_atomic FROM anon;
GRANT EXECUTE ON FUNCTION public.finalize_bill_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_bill_atomic TO service_role;

-- -----------------------------------------------------------------------
-- 11. ATOMIC MANUAL STOCK ADJUSTMENT FUNCTION
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_stock_atomic(
  p_product_id UUID,
  p_change_amount INT,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID;
  v_is_service_role BOOLEAN;
  v_shop_id UUID;
  v_shop_owner_id UUID;
  v_prod_name TEXT;
  v_current_stock INT;
  v_new_stock INT;
  v_movement_id UUID;
  v_actor_profile_id UUID;
BEGIN
  v_is_service_role := (COALESCE(auth.jwt()->>'role', '') = 'service_role');
  v_auth_user_id := auth.uid();

  -- 1. Authentication check
  IF NOT v_is_service_role AND v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Active authenticated session required';
  END IF;

  -- 2. Validate reason and change bounds
  IF p_reason NOT IN ('stock_in', 'damaged', 'return', 'adjustment') THEN
    RAISE EXCEPTION 'Bad request: Invalid adjustment reason "%". Allowed: stock_in, damaged, return, adjustment', p_reason;
  END IF;

  IF p_change_amount IS NULL OR p_change_amount = 0 THEN
    RAISE EXCEPTION 'Bad request: Change amount cannot be zero or null';
  END IF;

  IF p_change_amount > 100000 OR p_change_amount < -100000 THEN
    RAISE EXCEPTION 'Bad request: Change amount % exceeds acceptable bounds (+/- 100,000 units)', p_change_amount;
  END IF;

  -- 3. Lock product and fetch owning shop
  SELECT p.shop_id, p.name, p.stock_quantity, s.owner_id
  INTO v_shop_id, v_prod_name, v_current_stock, v_shop_owner_id
  FROM public.products p
  JOIN public.shops s ON p.shop_id = s.id
  WHERE p.id = p_product_id
  FOR UPDATE OF p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bad request: Product % does not exist', p_product_id;
  END IF;

  -- 4. Authorization check: authenticated callers must own the shop
  IF NOT v_is_service_role AND v_shop_owner_id <> v_auth_user_id THEN
    RAISE EXCEPTION 'Unauthorized or not found: Product % does not belong to a shop owned by user %', p_product_id, v_auth_user_id;
  END IF;

  -- 5. Determine audit trail actor (stock_movements.created_by references profiles.id)
  IF v_is_service_role THEN
    v_actor_profile_id := v_shop_owner_id;
  ELSE
    v_actor_profile_id := v_auth_user_id;
  END IF;

  -- 6. Validate new stock level
  v_new_stock := v_current_stock + p_change_amount;
  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Bad request: Stock adjustment would result in negative stock (% available, attempted change %)', v_current_stock, p_change_amount;
  END IF;

  -- 7. Authorize stock mutation in current transaction scope
  PERFORM set_config('locostock.stock_mutation_authorized', 'true', true);

  -- 8. Update product stock quantity
  UPDATE public.products
  SET stock_quantity = v_new_stock,
      last_inventory_update = NOW(),
      updated_at = NOW()
  WHERE id = p_product_id;

  -- 9. Clear transaction scope token
  PERFORM set_config('locostock.stock_mutation_authorized', 'false', true);

  -- 10. Record stock movement audit trail
  INSERT INTO public.stock_movements (
    product_id, shop_id, change_amount, quantity_after, reason, reference_invoice_id, created_by, notes
  ) VALUES (
    p_product_id, v_shop_id, p_change_amount, v_new_stock, p_reason, NULL, v_actor_profile_id,
    CASE 
      WHEN v_is_service_role THEN COALESCE(p_notes, 'Administrative stock adjustment (service_role)')
      ELSE COALESCE(p_notes, 'Manual stock adjustment')
    END
  ) RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'quantity_before', v_current_stock,
    'change_amount', p_change_amount,
    'quantity_after', v_new_stock,
    'movement_id', v_movement_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.adjust_stock_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.adjust_stock_atomic FROM anon;
GRANT EXECUTE ON FUNCTION public.adjust_stock_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock_atomic TO service_role;

-- -----------------------------------------------------------------------
-- 12. ADMIN SHOP VERIFICATION & ATOMIC ROLE PROMOTION FUNCTION
-- -----------------------------------------------------------------------
-- Platform administrators with service_role OR cryptographically verified app_metadata->is_admin
-- can execute this function.
CREATE OR REPLACE FUNCTION public.admin_verify_shop(
  p_shop_id UUID,
  p_is_verified BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id UUID;
  v_shop_name TEXT;
  v_prev_verified BOOLEAN;
BEGIN
  -- Strict administrative check against verified JWT claims
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' 
     AND COALESCE(auth.jwt()->'app_metadata'->>'is_admin', '') <> 'true' THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can verify shops';
  END IF;

  SELECT owner_id, name, is_verified 
  INTO v_owner_id, v_shop_name, v_prev_verified
  FROM public.shops
  WHERE id = p_shop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop % not found', p_shop_id;
  END IF;

  -- Update shop verification status
  UPDATE public.shops
  SET is_verified = p_is_verified, updated_at = NOW()
  WHERE id = p_shop_id;

  -- If verified and owner is not yet shopkeeper, promote role
  IF p_is_verified THEN
    UPDATE public.profiles
    SET role = 'shopkeeper', updated_at = NOW()
    WHERE id = v_owner_id AND role <> 'shopkeeper';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'shop_id', p_shop_id,
    'name', v_shop_name,
    'is_verified', p_is_verified,
    'owner_id', v_owner_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_verify_shop FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_verify_shop FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_verify_shop TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_shop TO service_role;

-- -----------------------------------------------------------------------
-- 13. AUDIT & CONFIGURE PRIVILEGE-BASED PERMISSIONS
-- -----------------------------------------------------------------------
-- 13.1 Financial & Audit Tables: Strictly Read-Only for Clients
REVOKE INSERT, UPDATE, DELETE ON public.invoices FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.invoice_items FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.stock_movements FROM authenticated, anon, PUBLIC;

GRANT SELECT ON public.invoices TO authenticated;
GRANT SELECT ON public.invoice_items TO authenticated;
GRANT SELECT ON public.stock_movements TO authenticated;

-- 13.2 Profiles & Shops Tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT SELECT ON public.shops TO anon;

-- 13.3 Products Table: Privilege-Based Architecture
-- Revoke all table-level write privileges from authenticated, anon, and PUBLIC:
REVOKE INSERT, UPDATE, DELETE ON public.products FROM authenticated, anon, PUBLIC;

-- Allow SELECT for discovery & management (filtered by RLS):
GRANT SELECT ON public.products TO authenticated, anon;

-- Allow DELETE for shop owners on their own products (filtered by RLS):
GRANT DELETE ON public.products TO authenticated;

-- Allow INSERT ONLY on permitted metadata columns (stock_quantity is EXCLUDED):
GRANT INSERT (
  id,
  shop_id,
  name,
  description,
  category,
  brand,
  sku,
  price,
  image_url,
  is_active,
  is_archived,
  created_at,
  updated_at
) ON public.products TO authenticated;

-- Allow UPDATE ONLY on permitted metadata columns (stock_quantity is EXCLUDED):
GRANT UPDATE (
  shop_id,
  name,
  description,
  category,
  brand,
  sku,
  price,
  image_url,
  is_active,
  is_archived,
  updated_at
) ON public.products TO authenticated;

-- -----------------------------------------------------------------------
-- 14. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- 14.1 Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 14.2 Shops Policies
DROP POLICY IF EXISTS "Public can view active verified shops and owners can view own shops" ON public.shops;
CREATE POLICY "Public can view active verified shops and owners can view own shops"
  ON public.shops FOR SELECT
  USING ((is_verified = true AND is_archived = false) OR auth.uid() = owner_id);

DROP POLICY IF EXISTS "Authenticated users can create a draft shop" ON public.shops;
CREATE POLICY "Authenticated users can create a draft shop"
  ON public.shops FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Shop owners can update their own shop details" ON public.shops;
CREATE POLICY "Shop owners can update their own shop details"
  ON public.shops FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Shop owners can delete their own shop if no financial history exists" ON public.shops;
CREATE POLICY "Shop owners can delete their own shop if no financial history exists"
  ON public.shops FOR DELETE
  USING (auth.uid() = owner_id);

-- 14.3 Products Policies
DROP POLICY IF EXISTS "Public discovery of active products in verified shops" ON public.products;
CREATE POLICY "Public discovery of active products in verified shops"
  ON public.products FOR SELECT
  USING (
    (
      is_active = true AND 
      is_archived = false AND
      EXISTS (
        SELECT 1 FROM public.shops 
        WHERE shops.id = products.shop_id AND shops.is_verified = true AND shops.is_archived = false
      )
    )
    OR 
    EXISTS (
      SELECT 1 FROM public.shops 
      WHERE shops.id = products.shop_id AND shops.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Shop owners can insert products into their shop" ON public.products;
CREATE POLICY "Shop owners can insert products into their shop"
  ON public.products FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops WHERE id = products.shop_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Shop owners can update products in their shop" ON public.products;
CREATE POLICY "Shop owners can update products in their shop"
  ON public.products FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.shops WHERE id = products.shop_id AND owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops WHERE id = products.shop_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Shop owners can delete products from their shop" ON public.products;
CREATE POLICY "Shop owners can delete products from their shop"
  ON public.products FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.shops WHERE id = products.shop_id AND owner_id = auth.uid())
  );

-- 14.4 Invoices Policies (SELECT only; writes handled exclusively by finalize_bill_atomic)
DROP POLICY IF EXISTS "Shop owners can view invoices for their shop" ON public.invoices;
CREATE POLICY "Shop owners can view invoices for their shop"
  ON public.invoices FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.shops WHERE id = invoices.shop_id AND owner_id = auth.uid())
  );

-- 14.5 Invoice Line Items Policies (SELECT only)
DROP POLICY IF EXISTS "Shop owners can view line items for their shop invoices" ON public.invoice_items;
CREATE POLICY "Shop owners can view line items for their shop invoices"
  ON public.invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      JOIN public.shops ON invoices.shop_id = shops.id
      WHERE invoices.id = invoice_items.invoice_id AND shops.owner_id = auth.uid()
    )
  );

-- 14.6 Stock Movements Policies (SELECT only)
DROP POLICY IF EXISTS "Shop owners can view stock movements for their shop" ON public.stock_movements;
CREATE POLICY "Shop owners can view stock movements for their shop"
  ON public.stock_movements FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.shops WHERE id = stock_movements.shop_id AND owner_id = auth.uid())
  );

-- -----------------------------------------------------------------------
-- 15. TRIGGERS & BUSINESS INTEGRITY ENFORCEMENT
-- -----------------------------------------------------------------------

-- 15.1 Protect Profile Role from Client Modification (Cryptographically verified JWT claim only)
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' 
       AND COALESCE(auth.jwt()->'app_metadata'->>'is_admin', '') <> 'true' THEN
      RAISE EXCEPTION 'Unauthorized: Only platform administrators can modify user roles';
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tr_protect_profile_role ON public.profiles;
CREATE TRIGGER tr_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- 15.2 Force Default Role on Profile Insert
CREATE OR REPLACE FUNCTION public.protect_profile_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' 
     AND COALESCE(auth.jwt()->'app_metadata'->>'is_admin', '') <> 'true' THEN
    NEW.role := 'customer';
  END IF;
  NEW.created_at := COALESCE(NEW.created_at, NOW());
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tr_protect_profile_insert ON public.profiles;
CREATE TRIGGER tr_protect_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_insert();

-- 15.3 Protect Shop Critical Fields
CREATE OR REPLACE FUNCTION public.protect_shop_critical_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' 
     AND COALESCE(auth.jwt()->'app_metadata'->>'is_admin', '') <> 'true' THEN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'Unauthorized: Shop ownership cannot be transferred directly';
    END IF;
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
      RAISE EXCEPTION 'Unauthorized: Only platform administrators can change shop verification status';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      NEW.created_at := OLD.created_at;
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tr_protect_shop_fields ON public.shops;
CREATE TRIGGER tr_protect_shop_fields
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.protect_shop_critical_fields();

-- 15.4 Force Draft Status on Shop Creation
CREATE OR REPLACE FUNCTION public.protect_shop_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' 
     AND COALESCE(auth.jwt()->'app_metadata'->>'is_admin', '') <> 'true' THEN
    NEW.is_verified := FALSE;
    NEW.is_archived := FALSE;
    NEW.owner_id := auth.uid();
  END IF;
  NEW.created_at := COALESCE(NEW.created_at, NOW());
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tr_protect_shop_insert ON public.shops;
CREATE TRIGGER tr_protect_shop_insert
  BEFORE INSERT ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.protect_shop_insert();

-- 15.5 Defense-in-Depth: Enforce Initial Product Stock is 0 on Insert
CREATE OR REPLACE FUNCTION public.protect_product_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' THEN
    NEW.stock_quantity := 0;
  END IF;
  NEW.created_at := COALESCE(NEW.created_at, NOW());
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tr_protect_product_insert ON public.products;
CREATE TRIGGER tr_protect_product_insert
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.protect_product_insert();

-- 15.6 Defense-in-Depth: Protect Product Stock Updates (Token & Execution Context Verified)
-- Stock quantity modifications are strictly prohibited outside trusted inventory functions
-- (finalize_bill_atomic and adjust_stock_atomic). Direct updates without audit logging are rejected.
CREATE OR REPLACE FUNCTION public.protect_product_stock_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock_quantity IS DISTINCT FROM OLD.stock_quantity THEN
    -- Stock quantity modifications are strictly prohibited outside trusted inventory functions
    -- 1. Must possess the transaction-local authorization token set by finalize_bill_atomic or adjust_stock_atomic
    -- 2. Must be executing within a privileged SECURITY DEFINER context or trusted service_role
    IF current_setting('locostock.stock_mutation_authorized', true) <> 'true'
       OR (CURRENT_USER = SESSION_USER AND COALESCE(auth.jwt()->>'role', '') <> 'service_role') THEN
      RAISE EXCEPTION 'Forbidden: Direct stock quantity modifications are prohibited. Stock must be modified exclusively through authorized inventory functions (finalize_bill_atomic or adjust_stock_atomic).';
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tr_protect_product_stock_update ON public.products;
CREATE TRIGGER tr_protect_product_stock_update
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.protect_product_stock_update();

-- 15.7 Automatic Profile Provisioning on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_display_name TEXT;
BEGIN
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NULLIF(split_part(NEW.email, '@', 1), ''),
    NEW.phone,
    'User'
  );

  INSERT INTO public.profiles (id, email, phone, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    v_display_name,
    'customer'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = COALESCE(EXCLUDED.email, public.profiles.email),
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
      updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
