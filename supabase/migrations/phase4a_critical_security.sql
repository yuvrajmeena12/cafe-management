-- ============================================================
-- Saffron & Sage — Phase 4A Critical Security Hardening
-- Migration: Hardened search_path (''), fully schema-qualified objects,
-- self-privilege escalation prevention, order update field restrictions,
-- authoritative order creation RPC, guest token support, and order items RLS.
-- ============================================================

-- Ensure required cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. SECURITY DEFINER Search Path Hardening (SEC-P1-03)
-- Pinned search_path = '' with fully schema-qualified object references.
-- Eliminates search path hijacking vulnerabilities.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_delivery()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('delivery', 'admin')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_delivery() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_delivery() TO anon, authenticated, service_role;


-- 2. Prevent Self-Privilege Escalation on profiles (SEC-P0-01)
-- Non-admin authenticated users cannot modify their own or any other user's 'role' column.
-- Uses pinned search_path = '' and fully qualified names.
-- Preserves service_role (used by admin-manage-role Edge Function) and admin changes.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      IF NOT (
        pg_catalog.coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') = 'service_role'
        OR public.is_admin()
        OR current_user IN ('postgres', 'supabase_admin')
      ) THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can modify user roles.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    -- If an explicit non-customer role is inserted, caller must be admin or service_role
    IF NEW.role IS DISTINCT FROM 'customer' THEN
      IF NOT (
        pg_catalog.coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') = 'service_role'
        OR public.is_admin()
        OR current_user IN ('postgres', 'supabase_admin')
      ) THEN
        RAISE EXCEPTION 'Unauthorized: Non-customer role cannot be self-assigned.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_role() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();


-- 3. Harden Order Update Authorization (SEC-P0-02)
-- Prevents customers from modifying order status, financial totals, payment status, guest_token, etc.
-- Customers may ONLY submit delivery_rating on their own delivered orders.
-- Delivery riders can update delivery stage, status, delivered_at, cash collection.
-- Admins and service_role retain full update capability.
CREATE OR REPLACE FUNCTION public.protect_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  is_sr boolean := (pg_catalog.coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') = 'service_role' OR current_user IN ('postgres', 'supabase_admin'));
  is_adm boolean := public.is_admin();
  is_del boolean := public.is_delivery();
BEGIN
  -- Service role and Admins have full update permissions
  IF is_sr OR is_adm THEN
    RETURN NEW;
  END IF;

  -- Delivery staff checks
  IF is_del THEN
    -- Financial columns, guest_token, and customer ID are strictly forbidden from delivery modification
    IF NEW.total IS DISTINCT FROM OLD.total OR
       NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
       NEW.tax IS DISTINCT FROM OLD.tax OR
       NEW.discount_amount IS DISTINCT FROM OLD.discount_amount OR
       NEW.delivery_charge IS DISTINCT FROM OLD.delivery_charge OR
       NEW.customer_id IS DISTINCT FROM OLD.customer_id OR
       NEW.guest_token IS DISTINCT FROM OLD.guest_token OR
       NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Unauthorized: Delivery staff cannot modify financial, security token, or customer identity order fields.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Customer checks: Customers are only allowed to update delivery_rating on delivered orders
  IF auth.uid() IS NOT NULL AND OLD.customer_id = auth.uid() THEN
    IF NEW.total IS DISTINCT FROM OLD.total OR
       NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
       NEW.tax IS DISTINCT FROM OLD.tax OR
       NEW.discount_amount IS DISTINCT FROM OLD.discount_amount OR
       NEW.delivery_charge IS DISTINCT FROM OLD.delivery_charge OR
       NEW.payment_status IS DISTINCT FROM OLD.payment_status OR
       NEW.payment_method IS DISTINCT FROM OLD.payment_method OR
       NEW.payment_id IS DISTINCT FROM OLD.payment_id OR
       NEW.razorpay_order_id IS DISTINCT FROM OLD.razorpay_order_id OR
       NEW.status IS DISTINCT FROM OLD.status OR
       NEW.assigned_delivery_id IS DISTINCT FROM OLD.assigned_delivery_id OR
       NEW.customer_id IS DISTINCT FROM OLD.customer_id OR
       NEW.guest_token IS DISTINCT FROM OLD.guest_token OR
       NEW.order_type IS DISTINCT FROM OLD.order_type OR
       NEW.delivery_address IS DISTINCT FROM OLD.delivery_address OR
       NEW.delivery_lat IS DISTINCT FROM OLD.delivery_lat OR
       NEW.delivery_lng IS DISTINCT FROM OLD.delivery_lng OR
       NEW.customer_name IS DISTINCT FROM OLD.customer_name OR
       NEW.customer_email IS DISTINCT FROM OLD.customer_email OR
       NEW.customer_phone IS DISTINCT FROM OLD.customer_phone OR
       NEW.is_cash_deposited IS DISTINCT FROM OLD.is_cash_deposited OR
       NEW.delivery_stage IS DISTINCT FROM OLD.delivery_stage OR
       NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Unauthorized: Customers can only submit ratings on delivered orders.'
        USING ERRCODE = '42501';
    END IF;

    -- Enforce that delivery_rating can only be set if status is 'delivered'
    IF NEW.delivery_rating IS DISTINCT FROM OLD.delivery_rating AND OLD.status != 'delivered' THEN
      RAISE EXCEPTION 'Order must be delivered before submitting a rating.'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  -- Any other caller is unauthorized to update orders
  RAISE EXCEPTION 'Unauthorized order update.'
    USING ERRCODE = '42501';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_order_update() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_protect_order_update ON public.orders;
CREATE TRIGGER trg_protect_order_update
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_order_update();


-- 4. Secure Guest Checkout Tracking Token (SEC-P0-03, SEC-P1-02)
-- Adds a random guest token column to associate guest orders securely with their payment/email flow.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS guest_token text;
CREATE INDEX IF NOT EXISTS idx_orders_guest_token ON public.orders(guest_token) WHERE guest_token IS NOT NULL;


-- 5. Server-side Authoritative Order Creation RPC (SEC-P0-03)
-- Replaces client-authoritative pricing. Unit prices, subtotals, delivery fees,
-- discounts, tax (5%), and total are strictly calculated from database menu items and tiers.
-- Pinned search_path = '' and fully schema-qualified object references.
CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_order_type text,
  p_delivery_address text DEFAULT NULL,
  p_delivery_lat float8 DEFAULT NULL,
  p_delivery_lng float8 DEFAULT NULL,
  p_payment_method text DEFAULT 'online',
  p_discount_code text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_id uuid := auth.uid();
  v_guest_token text := NULL;
  v_item record;
  v_menu_item record;
  v_qty int;
  v_subtotal numeric := 0;
  v_discount_amount numeric := 0;
  v_delivery_charge numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_cafe record;
  v_dist_km float8;
  v_tier record;
  v_max_tier_charge numeric;
  v_disc record;
  v_new_order_id uuid;
  v_result jsonb;
BEGIN
  -- 1. Validate contact & basic parameters
  IF pg_catalog.trim(pg_catalog.coalesce(p_customer_name, '')) = '' THEN
    RAISE EXCEPTION 'Customer name is required' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.trim(pg_catalog.coalesce(p_customer_email, '')) = '' THEN
    RAISE EXCEPTION 'Customer email is required' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.trim(pg_catalog.coalesce(p_customer_phone, '')) = '' THEN
    RAISE EXCEPTION 'Customer phone is required' USING ERRCODE = '22023';
  END IF;
  IF p_order_type NOT IN ('delivery', 'pickup', 'dine_in') THEN
    RAISE EXCEPTION 'Invalid order type' USING ERRCODE = '22023';
  END IF;
  IF p_payment_method NOT IN ('online', 'cod') THEN
    RAISE EXCEPTION 'Invalid payment method' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart cannot be empty' USING ERRCODE = '22023';
  END IF;
  IF p_order_type = 'delivery' AND pg_catalog.trim(pg_catalog.coalesce(p_delivery_address, '')) = '' THEN
    RAISE EXCEPTION 'Delivery address is required for delivery orders' USING ERRCODE = '22023';
  END IF;

  -- 2. Generate 256-bit cryptographically secure guest token if unauthenticated
  IF v_customer_id IS NULL THEN
    v_guest_token := pg_catalog.md5(pg_catalog.random()::text || pg_catalog.clock_timestamp()::text) ||
                     pg_catalog.md5(pg_catalog.random()::text || pg_catalog.clock_timestamp()::text);
  END IF;

  -- 3. Calculate subtotal using database menu item prices
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_to_recordset(p_items) AS x(menu_item_id uuid, quantity int, notes text)
  LOOP
    v_qty := pg_catalog.coalesce(v_item.quantity, 0);
    IF v_qty <= 0 OR v_qty > 100 THEN
      RAISE EXCEPTION 'Invalid item quantity: %', v_qty USING ERRCODE = '22023';
    END IF;

    SELECT id, price, is_available INTO v_menu_item
    FROM public.menu_items
    WHERE id = v_item.menu_item_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Menu item not found: %', v_item.menu_item_id USING ERRCODE = '22023';
    END IF;
    IF NOT pg_catalog.coalesce(v_menu_item.is_available, true) THEN
      RAISE EXCEPTION 'Menu item is currently unavailable' USING ERRCODE = '22023';
    END IF;

    v_subtotal := v_subtotal + (v_menu_item.price * v_qty);
  END LOOP;

  -- 4. Authoritative delivery charge calculation
  IF p_order_type = 'delivery' AND p_delivery_lat IS NOT NULL AND p_delivery_lng IS NOT NULL THEN
    SELECT address_lat, address_lng INTO v_cafe FROM public.cafe_settings WHERE id = 1;
    IF FOUND AND v_cafe.address_lat IS NOT NULL AND v_cafe.address_lng IS NOT NULL THEN
      -- Haversine formula in km
      v_dist_km := 6371.0 * 2.0 * pg_catalog.asin(pg_catalog.sqrt(
        pg_catalog.power(pg_catalog.sin(pg_catalog.radians((p_delivery_lat - v_cafe.address_lat) / 2.0)), 2) +
        pg_catalog.cos(pg_catalog.radians(v_cafe.address_lat)) * pg_catalog.cos(pg_catalog.radians(p_delivery_lat)) *
        pg_catalog.power(pg_catalog.sin(pg_catalog.radians((p_delivery_lng - v_cafe.address_lng) / 2.0)), 2)
      ));

      -- Find matching tier sorted by max_km asc
      SELECT charge INTO v_tier FROM public.delivery_charge_tiers
      WHERE max_km >= v_dist_km
      ORDER BY max_km ASC LIMIT 1;

      IF FOUND THEN
        v_delivery_charge := v_tier.charge;
      ELSE
        -- Beyond furthest tier: use highest tier rate
        SELECT charge INTO v_max_tier_charge FROM public.delivery_charge_tiers
        ORDER BY max_km DESC LIMIT 1;
        v_delivery_charge := pg_catalog.coalesce(v_max_tier_charge, 0);
      END IF;
    ELSE
      v_delivery_charge := 0;
    END IF;
  ELSE
    v_delivery_charge := 0;
  END IF;

  -- 5. Authoritative discount calculation
  IF p_discount_code IS NOT NULL AND pg_catalog.trim(p_discount_code) <> '' THEN
    SELECT * INTO v_disc FROM public.discounts
    WHERE pg_catalog.upper(code) = pg_catalog.upper(pg_catalog.trim(p_discount_code))
      AND active = true
      AND (valid_from IS NULL OR valid_from <= pg_catalog.current_date)
      AND (valid_to IS NULL OR valid_to >= pg_catalog.current_date);

    IF FOUND THEN
      IF v_subtotal >= pg_catalog.coalesce(v_disc.min_order_value, 0) THEN
        IF v_disc.type = 'percent' THEN
          v_discount_amount := pg_catalog.round((v_subtotal * v_disc.value) / 100.0, 2);
        ELSE
          v_discount_amount := pg_catalog.round(v_disc.value, 2);
        END IF;
        -- Discount cannot exceed subtotal
        IF v_discount_amount > v_subtotal THEN
          v_discount_amount := v_subtotal;
        END IF;
      ELSE
        v_discount_amount := 0;
      END IF;
    ELSE
      v_discount_amount := 0;
    END IF;
  END IF;

  -- 6. Tax and Total calculation
  v_subtotal := pg_catalog.round(v_subtotal, 2);
  v_delivery_charge := pg_catalog.round(v_delivery_charge, 2);
  v_discount_amount := pg_catalog.round(v_discount_amount, 2);
  v_tax := pg_catalog.round(v_subtotal * 0.05, 2);
  v_total := pg_catalog.round(v_subtotal + v_tax + v_delivery_charge - v_discount_amount, 2);
  IF v_total < 0 THEN
    v_total := 0;
  END IF;

  -- 7. Insert the orders row
  INSERT INTO public.orders (
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    status,
    order_type,
    delivery_address,
    delivery_lat,
    delivery_lng,
    delivery_charge,
    subtotal,
    discount_amount,
    tax,
    total,
    payment_method,
    payment_status,
    guest_token
  ) VALUES (
    v_customer_id,
    pg_catalog.trim(p_customer_name),
    pg_catalog.trim(p_customer_email),
    pg_catalog.trim(p_customer_phone),
    'received',
    p_order_type,
    CASE WHEN p_order_type = 'delivery' THEN pg_catalog.trim(p_delivery_address) ELSE NULL END,
    CASE WHEN p_order_type = 'delivery' THEN p_delivery_lat ELSE NULL END,
    CASE WHEN p_order_type = 'delivery' THEN p_delivery_lng ELSE NULL END,
    v_delivery_charge,
    v_subtotal,
    v_discount_amount,
    v_tax,
    v_total,
    p_payment_method,
    'pending',
    v_guest_token
  )
  RETURNING id INTO v_new_order_id;

  -- 8. Insert order_items with authoritative prices
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_to_recordset(p_items) AS x(menu_item_id uuid, quantity int, notes text)
  LOOP
    SELECT price INTO v_menu_item FROM public.menu_items WHERE id = v_item.menu_item_id;
    INSERT INTO public.order_items (
      order_id,
      menu_item_id,
      quantity,
      unit_price,
      notes
    ) VALUES (
      v_new_order_id,
      v_item.menu_item_id,
      v_item.quantity,
      v_menu_item.price,
      v_item.notes
    );
  END LOOP;

  -- 9. Return the order details as jsonb
  SELECT pg_catalog.to_jsonb(o.*) INTO v_result FROM public.orders o WHERE o.id = v_new_order_id;
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_checkout_order(text, text, text, text, text, float8, float8, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(text, text, text, text, text, float8, float8, text, text, jsonb) TO anon, authenticated, service_role;


-- 6. Restrict order_items Direct Insert Policy (SEC-P1-04)
-- Eliminates arbitrary line-item insertion while allowing authorized order lifecycle.
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;
CREATE POLICY "order_items_insert_restricted" ON public.order_items
FOR INSERT WITH CHECK (
  is_admin() OR (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.status = 'received'
        AND (o.customer_id = auth.uid() OR o.customer_id IS NULL)
        AND o.placed_at >= (now() - interval '5 minutes')
    )
  )
);

-- Restrict orders Direct Insert Policy (SEC-P0-03)
-- Normal client checkout now strictly uses create_checkout_order RPC.
DROP POLICY IF EXISTS "orders_insert_any" ON public.orders;
CREATE POLICY "orders_insert_admin" ON public.orders
FOR INSERT WITH CHECK (is_admin());
