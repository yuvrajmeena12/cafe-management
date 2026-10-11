-- ============================================================
-- Saffron & Sage — Phase 4B-4 Rate Limiting & Abuse Hardening
-- Migration: Creates native PostgreSQL rate-limit infrastructure,
-- atomic check_rate_limit RPC, and integrates privacy-preserving
-- guest checkout throttling into create_checkout_order.
-- ============================================================

-- Ensure pgcrypto extension for digest / hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. RATE LIMIT ENTRIES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_entries (
  key text PRIMARY KEY,
  request_count integer NOT NULL CHECK (request_count >= 1),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_entries_expires_at
ON public.rate_limit_entries (expires_at);

-- Enable RLS on rate_limit_entries
ALTER TABLE public.rate_limit_entries ENABLE ROW LEVEL SECURITY;

-- No direct client access to rate limit table
DROP POLICY IF EXISTS "rate_limit_entries_no_client_access" ON public.rate_limit_entries;
-- Service role and SECURITY DEFINER functions bypass RLS automatically


-- ============================================================
-- 2. ATOMIC RATE LIMIT CHECK RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_entry record;
  v_retry_after integer := 0;
  v_key text;
BEGIN
  v_key := pg_catalog.trim(p_key);
  IF v_key = '' OR v_key IS NULL THEN
    RAISE EXCEPTION 'Rate limit key cannot be empty' USING ERRCODE = '22023';
  END IF;

  IF p_max_requests <= 0 OR p_max_requests > 100000 THEN
    RAISE EXCEPTION 'Invalid max_requests: must be between 1 and 100000' USING ERRCODE = '22023';
  END IF;

  IF p_window_seconds <= 0 OR p_window_seconds > 2592000 THEN
    RAISE EXCEPTION 'Invalid window_seconds: must be between 1 and 2592000' USING ERRCODE = '22023';
  END IF;

  -- Prune old expired entries to prevent table bloat
  DELETE FROM public.rate_limit_entries
  WHERE expires_at < (v_now - interval '1 minute');

  -- Lock entry row if it exists
  SELECT * INTO v_entry
  FROM public.rate_limit_entries
  WHERE key = v_key
  FOR UPDATE;

  -- If not found or currently expired, initialize fresh window
  IF NOT FOUND OR v_entry.expires_at <= v_now THEN
    INSERT INTO public.rate_limit_entries (key, request_count, expires_at)
    VALUES (v_key, 1, v_now + (p_window_seconds || ' seconds')::interval)
    ON CONFLICT (key) DO UPDATE
    SET request_count = 1,
        expires_at = v_now + (p_window_seconds || ' seconds')::interval;

    RETURN pg_catalog.jsonb_build_object(
      'allowed', true,
      'current_count', 1,
      'max_requests', p_max_requests,
      'retry_after', 0
    );
  END IF;

  -- Window is active
  IF v_entry.request_count < p_max_requests THEN
    UPDATE public.rate_limit_entries
    SET request_count = request_count + 1
    WHERE key = v_key;

    RETURN pg_catalog.jsonb_build_object(
      'allowed', true,
      'current_count', v_entry.request_count + 1,
      'max_requests', p_max_requests,
      'retry_after', 0
    );
  ELSE
    v_retry_after := pg_catalog.ceil(EXTRACT(EPOCH FROM (v_entry.expires_at - v_now)))::integer;
    IF v_retry_after < 0 THEN
      v_retry_after := 0;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'allowed', false,
      'current_count', v_entry.request_count,
      'max_requests', p_max_requests,
      'retry_after', v_retry_after
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;


-- ============================================================
-- 3. GUEST CHECKOUT ABUSE PROTECTION INTEGRATION
-- ============================================================

-- Re-declares public.create_checkout_order with privacy-preserving guest rate limiting
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
  v_subtotal numeric := 0;
  v_delivery_charge numeric := 0;
  v_discount_amount numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_guest_token text := NULL;
  v_order_id uuid;
  v_result jsonb;
  v_item record;
  v_qty int;
  v_menu_item record;
  v_cafe record;
  v_dist_km numeric;
  v_tier record;
  v_max_tier_charge numeric;
  v_disc record;
  v_clean_email text;
  v_clean_phone text;
  v_contact_hash text;
  v_rate_res jsonb;
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

  -- 2. Guest rate-limiting and token generation
  IF v_customer_id IS NULL THEN
    -- Normalize contact details for rate limiting
    v_clean_email := pg_catalog.lower(pg_catalog.trim(pg_catalog.coalesce(p_customer_email, '')));
    v_clean_phone := pg_catalog.regexp_replace(pg_catalog.coalesce(p_customer_phone, ''), '\D', '', 'g');
    -- Canonicalize 10-digit mobile numbers (strip country code 91 or leading 0 to prevent bypass)
    IF pg_catalog.length(v_clean_phone) = 12 AND pg_catalog.substr(v_clean_phone, 1, 2) = '91' THEN
      v_clean_phone := pg_catalog.substr(v_clean_phone, 3);
    ELSIF pg_catalog.length(v_clean_phone) = 11 AND pg_catalog.substr(v_clean_phone, 1, 1) = '0' THEN
      v_clean_phone := pg_catalog.substr(v_clean_phone, 2);
    END IF;

    -- Privacy-preserving SHA-256 hash
    v_contact_hash := pg_catalog.encode(pg_catalog.digest(v_clean_email || ':' || v_clean_phone, 'sha256'), 'hex');

    -- Max 5 orders per 15 minutes (900 seconds) per guest contact
    v_rate_res := public.check_rate_limit('guest_order:' || v_contact_hash, 5, 900);
    IF (v_rate_res->>'allowed')::boolean = false THEN
      RAISE EXCEPTION 'Too many guest orders placed recently. Please wait a few minutes before trying again.'
        USING ERRCODE = 'P0001';
    END IF;

    -- Generate 256-bit cryptographically secure guest token
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
  RETURNING id INTO v_order_id;

  -- 8. Insert order items
  FOR v_item IN SELECT * FROM pg_catalog.jsonb_to_recordset(p_items) AS x(menu_item_id uuid, quantity int, notes text)
  LOOP
    SELECT price INTO v_menu_item FROM public.menu_items WHERE id = v_item.menu_item_id;
    INSERT INTO public.order_items (order_id, menu_item_id, quantity, unit_price, notes)
    VALUES (v_order_id, v_item.menu_item_id, v_item.quantity, v_menu_item.price, v_item.notes);
  END LOOP;

  -- 9. Return the complete order details as jsonb
  SELECT pg_catalog.to_jsonb(o.*) INTO v_result FROM public.orders o WHERE o.id = v_order_id;
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_checkout_order(text, text, text, text, text, float8, float8, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(text, text, text, text, text, float8, float8, text, text, jsonb) TO anon, authenticated, service_role;
