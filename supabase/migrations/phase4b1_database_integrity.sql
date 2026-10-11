-- ============================================================
-- Saffron & Sage — Phase 4B-1 Database Integrity & Audit Hardening
-- Migration: Review uniqueness & authorization, case-insensitive role invites,
-- discount exposure hardening, numeric database CHECK constraints,
-- and append-only audit logging for critical security/business actions.
-- ============================================================

-- Ensure required cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- 1. REVIEW AUTHORIZATION & UNIQUENESS (SEC-P2-02, SEC-P2-05)
-- ============================================================

-- A. Enforce database-level uniqueness: exactly one review record per order
-- Partial unique index permits historical or external reviews where order_id IS NULL,
-- while strictly preventing multiple reviews for the same order.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_order_id
ON public.reviews (order_id)
WHERE order_id IS NOT NULL;

-- B. Harden review insert RLS policy
-- Verifies:
-- 1. Caller is authenticated (auth.uid() is not null) or admin
-- 2. customer_id matches caller's auth.uid()
-- 3. order_id is non-null
-- 4. order belongs to authenticated customer
-- 5. order has status = 'delivered'
-- 6. menu_item_id (if specified) was legitimately part of the order in order_items
DROP POLICY IF EXISTS "reviews_customer_insert" ON public.reviews;
CREATE POLICY "reviews_customer_insert" ON public.reviews
FOR INSERT WITH CHECK (
  public.is_admin() OR (
    auth.uid() IS NOT NULL
    AND customer_id = auth.uid()
    AND order_id IS NOT NULL
    AND (
      menu_item_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.order_items oi
        WHERE oi.order_id = reviews.order_id
          AND oi.menu_item_id = reviews.menu_item_id
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = reviews.order_id
        AND o.customer_id = auth.uid()
        AND o.status = 'delivered'
    )
  )
);

-- C. Review mutation policies:
-- Customers cannot update reviews once submitted. Admins retain moderation update permissions.
DROP POLICY IF EXISTS "reviews_admin_update" ON public.reviews;
CREATE POLICY "reviews_admin_update" ON public.reviews
FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ============================================================
-- 2. CASE-INSENSITIVE ROLE INVITATIONS (SEC-P1-05)
-- ============================================================

-- Fast case-insensitive index on role_invites.email
CREATE INDEX IF NOT EXISTS idx_role_invites_lower_email
ON public.role_invites (pg_catalog.lower(email));

-- Harden handle_new_user() to compare email case-insensitively
-- Uses pinned search_path = '' and fully qualified names.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invited_role text;
  v_clean_email text;
BEGIN
  v_clean_email := pg_catalog.lower(pg_catalog.trim(pg_catalog.coalesce(NEW.email, '')));

  IF v_clean_email <> '' THEN
    SELECT role INTO v_invited_role
    FROM public.role_invites
    WHERE pg_catalog.lower(email) = v_clean_email
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    pg_catalog.coalesce(v_invited_role, 'customer')
  )
  ON CONFLICT (id) DO NOTHING;

  IF v_invited_role IS NOT NULL AND v_clean_email <> '' THEN
    DELETE FROM public.role_invites
    WHERE pg_catalog.lower(email) = v_clean_email;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;


-- ============================================================
-- 3. DISCOUNT DATA EXPOSURE HARDENING (SEC-P2-03)
-- ============================================================

-- Replace permissive USING (true) policy with restricted public view.
-- Non-admin callers can only select discounts that are currently active,
-- and within valid_from / valid_to date boundaries.
-- Admins retain full visibility of all discounts (draft, expired, inactive).
DROP POLICY IF EXISTS "discounts_public_read" ON public.discounts;
CREATE POLICY "discounts_public_read" ON public.discounts
FOR SELECT
USING (
  public.is_admin() OR (
    active = true
    AND (valid_from IS NULL OR valid_from <= pg_catalog.current_date)
    AND (valid_to IS NULL OR valid_to >= pg_catalog.current_date)
  )
);


-- ============================================================
-- 4. DATABASE NUMERIC INTEGRITY CONSTRAINTS (SEC-P2-06)
-- ============================================================

-- menu_items numeric sanity
ALTER TABLE public.menu_items DROP CONSTRAINT IF EXISTS chk_menu_items_price;
ALTER TABLE public.menu_items ADD CONSTRAINT chk_menu_items_price
  CHECK (price >= 0);

ALTER TABLE public.menu_items DROP CONSTRAINT IF EXISTS chk_menu_items_cost_price;
ALTER TABLE public.menu_items ADD CONSTRAINT chk_menu_items_cost_price
  CHECK (cost_price IS NULL OR cost_price >= 0);

ALTER TABLE public.menu_items DROP CONSTRAINT IF EXISTS chk_menu_items_calories;
ALTER TABLE public.menu_items ADD CONSTRAINT chk_menu_items_calories
  CHECK (calories IS NULL OR calories >= 0);

ALTER TABLE public.menu_items DROP CONSTRAINT IF EXISTS chk_menu_items_prep_time;
ALTER TABLE public.menu_items ADD CONSTRAINT chk_menu_items_prep_time
  CHECK (prep_time_minutes IS NULL OR prep_time_minutes >= 0);

-- orders numeric sanity
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_subtotal;
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_subtotal
  CHECK (subtotal >= 0);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_discount_amount;
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_discount_amount
  CHECK (discount_amount >= 0);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_tax;
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_tax
  CHECK (tax >= 0);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_delivery_charge;
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_delivery_charge
  CHECK (delivery_charge IS NULL OR delivery_charge >= 0);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_orders_total;
ALTER TABLE public.orders ADD CONSTRAINT chk_orders_total
  CHECK (total >= 0);

-- order_items numeric sanity
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS chk_order_items_quantity;
ALTER TABLE public.order_items ADD CONSTRAINT chk_order_items_quantity
  CHECK (quantity >= 1 AND quantity <= 100);

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS chk_order_items_unit_price;
ALTER TABLE public.order_items ADD CONSTRAINT chk_order_items_unit_price
  CHECK (unit_price >= 0);

-- inventory_items numeric sanity
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS chk_inventory_quantity;
ALTER TABLE public.inventory_items ADD CONSTRAINT chk_inventory_quantity
  CHECK (quantity >= 0);

ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS chk_inventory_min_level;
ALTER TABLE public.inventory_items ADD CONSTRAINT chk_inventory_min_level
  CHECK (min_level >= 0);

ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS chk_inventory_cost_per_unit;
ALTER TABLE public.inventory_items ADD CONSTRAINT chk_inventory_cost_per_unit
  CHECK (cost_per_unit >= 0);

-- expenses numeric sanity
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS chk_expenses_amount;
ALTER TABLE public.expenses ADD CONSTRAINT chk_expenses_amount
  CHECK (amount >= 0);

-- staff numeric sanity
ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS chk_staff_monthly_salary;
ALTER TABLE public.staff ADD CONSTRAINT chk_staff_monthly_salary
  CHECK (monthly_salary IS NULL OR monthly_salary >= 0);

-- discounts numeric and range sanity
ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS chk_discounts_value;
ALTER TABLE public.discounts ADD CONSTRAINT chk_discounts_value
  CHECK (value >= 0);

ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS chk_discounts_percent_range;
ALTER TABLE public.discounts ADD CONSTRAINT chk_discounts_percent_range
  CHECK (type <> 'percent' OR (value >= 0 AND value <= 100));

ALTER TABLE public.discounts DROP CONSTRAINT IF EXISTS chk_discounts_min_order_value;
ALTER TABLE public.discounts ADD CONSTRAINT chk_discounts_min_order_value
  CHECK (min_order_value IS NULL OR min_order_value >= 0);

-- delivery_charge_tiers numeric sanity
ALTER TABLE public.delivery_charge_tiers DROP CONSTRAINT IF EXISTS chk_delivery_tiers_max_km;
ALTER TABLE public.delivery_charge_tiers ADD CONSTRAINT chk_delivery_tiers_max_km
  CHECK (max_km > 0);

ALTER TABLE public.delivery_charge_tiers DROP CONSTRAINT IF EXISTS chk_delivery_tiers_charge;
ALTER TABLE public.delivery_charge_tiers ADD CONSTRAINT chk_delivery_tiers_charge
  CHECK (charge >= 0);


-- ============================================================
-- 5. APPEND-ONLY AUDIT LOGGING (SEC-P2-07)
-- ============================================================

-- A. Audit Logs Storage Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_table text NOT NULL,
  target_id text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes for audit query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs (target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs (actor_id);

-- B. RLS: Append-only, Admin-read-only
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_admin_select" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs
FOR SELECT USING (public.is_admin());

-- Notice: No INSERT, UPDATE, or DELETE policy is granted to public or normal users.
-- Only SECURITY DEFINER triggers and database owners can append audit records.

-- C. Database-level Immutability Trigger
-- Prevents ANY update or delete operation on audit_logs.
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and append-only. Modification or deletion is strictly forbidden.'
    USING ERRCODE = '42501';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_audit_log_mutation() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_log_mutation
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();


-- D. Audit Triggers for Critical Business & Security Actions

-- 1. Profile Role Changes Trigger
CREATE OR REPLACE FUNCTION public.audit_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.audit_logs (
      actor_id,
      action,
      target_table,
      target_id,
      old_values,
      new_values
    ) VALUES (
      auth.uid(),
      'ROLE_CHANGE',
      'profiles',
      NEW.id::text,
      pg_catalog.jsonb_build_object('role', OLD.role),
      pg_catalog.jsonb_build_object('role', NEW.role)
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_profile_role_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_audit_profile_role_change ON public.profiles;
CREATE TRIGGER trg_audit_profile_role_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_profile_role_change();


-- 2. Staff Salary & Status Changes Trigger
CREATE OR REPLACE FUNCTION public.audit_staff_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.monthly_salary IS DISTINCT FROM OLD.monthly_salary THEN
      INSERT INTO public.audit_logs (
        actor_id, action, target_table, target_id, old_values, new_values
      ) VALUES (
        auth.uid(),
        'STAFF_SALARY_CHANGE',
        'staff',
        NEW.id::text,
        pg_catalog.jsonb_build_object('name', OLD.name, 'monthly_salary', OLD.monthly_salary),
        pg_catalog.jsonb_build_object('name', NEW.name, 'monthly_salary', NEW.monthly_salary)
      );
    END IF;

    IF NEW.active IS DISTINCT FROM OLD.active THEN
      INSERT INTO public.audit_logs (
        actor_id, action, target_table, target_id, old_values, new_values
      ) VALUES (
        auth.uid(),
        'STAFF_STATUS_CHANGE',
        'staff',
        NEW.id::text,
        pg_catalog.jsonb_build_object('name', OLD.name, 'active', OLD.active),
        pg_catalog.jsonb_build_object('name', NEW.name, 'active', NEW.active)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_staff_mutation() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_audit_staff_mutation ON public.staff;
CREATE TRIGGER trg_audit_staff_mutation
  AFTER UPDATE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_staff_mutation();


-- 3. Inventory Quantity Adjustment Trigger
CREATE OR REPLACE FUNCTION public.audit_inventory_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    INSERT INTO public.audit_logs (
      actor_id, action, target_table, target_id, old_values, new_values
    ) VALUES (
      auth.uid(),
      'INVENTORY_ADJUSTMENT',
      'inventory_items',
      NEW.id::text,
      pg_catalog.jsonb_build_object('name', OLD.name, 'quantity', OLD.quantity),
      pg_catalog.jsonb_build_object('name', NEW.name, 'quantity', NEW.quantity)
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_inventory_mutation() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_audit_inventory_mutation ON public.inventory_items;
CREATE TRIGGER trg_audit_inventory_mutation
  AFTER UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_inventory_mutation();


-- 4. Expense Mutations Trigger (Create, Update, Delete)
CREATE OR REPLACE FUNCTION public.audit_expense_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      actor_id, action, target_table, target_id, old_values, new_values
    ) VALUES (
      auth.uid(),
      'EXPENSE_CREATE',
      'expenses',
      NEW.id::text,
      NULL,
      pg_catalog.jsonb_build_object('category', NEW.category, 'amount', NEW.amount, 'date', NEW.date, 'note', NEW.note)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (
      actor_id, action, target_table, target_id, old_values, new_values
    ) VALUES (
      auth.uid(),
      'EXPENSE_UPDATE',
      'expenses',
      NEW.id::text,
      pg_catalog.jsonb_build_object('category', OLD.category, 'amount', OLD.amount, 'date', OLD.date, 'note', OLD.note),
      pg_catalog.jsonb_build_object('category', NEW.category, 'amount', NEW.amount, 'date', NEW.date, 'note', NEW.note)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      actor_id, action, target_table, target_id, old_values, new_values
    ) VALUES (
      auth.uid(),
      'EXPENSE_DELETE',
      'expenses',
      OLD.id::text,
      pg_catalog.jsonb_build_object('category', OLD.category, 'amount', OLD.amount, 'date', OLD.date, 'note', OLD.note),
      NULL
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_expense_mutation() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_audit_expense_mutation ON public.expenses;
CREATE TRIGGER trg_audit_expense_mutation
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_expense_mutation();


-- 5. Discount Mutations Trigger (Create, Update, Delete)
CREATE OR REPLACE FUNCTION public.audit_discount_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      actor_id, action, target_table, target_id, old_values, new_values
    ) VALUES (
      auth.uid(),
      'DISCOUNT_CREATE',
      'discounts',
      NEW.id::text,
      NULL,
      pg_catalog.jsonb_build_object('code', NEW.code, 'type', NEW.type, 'value', NEW.value, 'min_order_value', NEW.min_order_value, 'active', NEW.active, 'valid_from', NEW.valid_from, 'valid_to', NEW.valid_to)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (
      actor_id, action, target_table, target_id, old_values, new_values
    ) VALUES (
      auth.uid(),
      'DISCOUNT_UPDATE',
      'discounts',
      NEW.id::text,
      pg_catalog.jsonb_build_object('code', OLD.code, 'type', OLD.type, 'value', OLD.value, 'min_order_value', OLD.min_order_value, 'active', OLD.active, 'valid_from', OLD.valid_from, 'valid_to', OLD.valid_to),
      pg_catalog.jsonb_build_object('code', NEW.code, 'type', NEW.type, 'value', NEW.value, 'min_order_value', NEW.min_order_value, 'active', NEW.active, 'valid_from', NEW.valid_from, 'valid_to', NEW.valid_to)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      actor_id, action, target_table, target_id, old_values, new_values
    ) VALUES (
      auth.uid(),
      'DISCOUNT_DELETE',
      'discounts',
      OLD.id::text,
      pg_catalog.jsonb_build_object('code', OLD.code, 'type', OLD.type, 'value', OLD.value, 'min_order_value', OLD.min_order_value, 'active', OLD.active),
      NULL
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_discount_mutation() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_audit_discount_mutation ON public.discounts;
CREATE TRIGGER trg_audit_discount_mutation
  AFTER INSERT OR UPDATE OR DELETE ON public.discounts
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_discount_mutation();


-- 6. Order Status & Administrative Override Trigger
-- Specifically redacts and omits sensitive secrets (guest_token, payment credentials)
CREATE OR REPLACE FUNCTION public.audit_order_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    INSERT INTO public.audit_logs (
      actor_id, action, target_table, target_id, old_values, new_values
    ) VALUES (
      auth.uid(),
      'ORDER_STATUS_UPDATE',
      'orders',
      NEW.id::text,
      pg_catalog.jsonb_build_object('status', OLD.status, 'payment_status', OLD.payment_status, 'total', OLD.total),
      pg_catalog.jsonb_build_object('status', NEW.status, 'payment_status', NEW.payment_status, 'total', NEW.total)
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_order_override() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_audit_order_override ON public.orders;
CREATE TRIGGER trg_audit_order_override
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_order_override();


-- 7. Cafe Settings Mutation Trigger
CREATE OR REPLACE FUNCTION public.audit_settings_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    actor_id, action, target_table, target_id, old_values, new_values
  ) VALUES (
    auth.uid(),
    'SETTINGS_UPDATE',
    'cafe_settings',
    '1',
    pg_catalog.jsonb_build_object('cafe_name', OLD.cafe_name, 'address', OLD.address, 'phone', OLD.phone, 'email', OLD.email, 'address_lat', OLD.address_lat, 'address_lng', OLD.address_lng),
    pg_catalog.jsonb_build_object('cafe_name', NEW.cafe_name, 'address', NEW.address, 'phone', NEW.phone, 'email', NEW.email, 'address_lat', NEW.address_lat, 'address_lng', NEW.address_lng)
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_settings_mutation() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_audit_settings_mutation ON public.cafe_settings;
CREATE TRIGGER trg_audit_settings_mutation
  AFTER UPDATE ON public.cafe_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_settings_mutation();
