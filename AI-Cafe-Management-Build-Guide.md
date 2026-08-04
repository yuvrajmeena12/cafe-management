# Saffron & Sage — AI Cafe Management System
### Full Build Guide (Client-Ready Project)

This guide takes your existing Bolt-built site (React + Tailwind frontend, with a working admin shell for Menu, Staff, Inventory, Dashboard) and turns it into a complete, production-grade cafe management platform: customer ordering site + admin control panel + backend + payments + AI features.

Everything below is organized so you can hand sections to different people (or just work top to bottom yourself) without losing the thread.

---

## 1. Tech Stack (final decision, with reasons)

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React 18 + TypeScript + Vite + Tailwind CSS** | Matches what Bolt already generated — no rewrite needed, just extend it |
| Animations | **Framer Motion** | Smooth page/element transitions, scroll reveals, cart/toast animations |
| Backend + DB | **Supabase** (Postgres + Auth + Storage + Realtime) | One platform gives you: database, login system, file storage (for photos), and *realtime* order updates (kitchen dashboard updates instantly) — this is critical for "Order Tracking" and "Kitchen Dashboard" to feel alive |
| Payments | **Razorpay** | Built for India, supports UPI/Cards/Netbanking/Wallets, settles in ₹, has a solid test mode |
| Maps / Location | **Google Maps JavaScript API + Places Autocomplete** | Customer drops a pin or autocompletes address; admin sees exact delivery coordinates |
| Notifications | **Email: Resend or SendGrid** · **WhatsApp: Twilio WhatsApp Business API (or Gupshup for India)** | Automated bill + offer messages |
| AI Recommendations / Prediction | **OpenAI API (or a simple weighted-scoring algorithm — see Section 8)** | Used for "AI Recommendation" and "Popular Food Prediction" |
| Chatbot | **OpenAI API with a system prompt fed your menu + FAQ data** | Answers "what's vegan", "where are you located", "track my order" type questions |
| Hosting | **Frontend: Vercel/Netlify · Backend: Supabase (managed) · Optional custom API: Railway/Render** | Zero-DevOps, cheap, scales fine for a single-cafe client |

> You do **not** need a separate custom backend server for most of this — Supabase's row-level security (RLS) + auto-generated REST/Realtime API can handle 90% of what you need. Only build a thin serverless function layer (Vercel/Supabase Edge Functions) for: Razorpay webhook verification, WhatsApp/email sending, and AI calls (so your API keys never sit in frontend code).

---

## 2. System Architecture (plain-English map)

```
┌─────────────────────┐        ┌──────────────────────┐
│   Customer Website   │        │     Admin Panel       │
│  (public, no login   │        │ (role = admin, login  │
│   needed to browse)  │        │  required)            │
└──────────┬───────────┘        └──────────┬────────────┘
           │                               │
           ▼                               ▼
     ┌─────────────────────────────────────────┐
     │      Supabase (Auth + Postgres DB +      │
     │      Storage + Realtime channels)        │
     └──────────┬───────────────────┬───────────┘
                │                   │
                ▼                   ▼
     ┌────────────────────┐   ┌──────────────────────┐
     │ Edge Functions      │   │ External Services     │
     │ - razorpay-webhook  │   │ - Razorpay             │
     │ - send-whatsapp     │   │ - Twilio/Gupshup       │
     │ - send-email        │   │ - Resend/SendGrid      │
     │ - ai-recommend       │   │ - Google Maps          │
     │ - ai-chatbot         │   │ - OpenAI               │
     └────────────────────┘   └──────────────────────┘
```

**Golden rule to avoid the "damaged reputation" scenario you mentioned:** the customer site and admin panel both read/write the *same* Supabase tables. There is only ONE source of truth. Never hardcode menu items, prices, or staff data into the frontend — everything must come from the database, or the admin's edits won't show up live (this was likely a gap in the current Bolt version, which looks like it's using static/local state).

---

## 3. Database Schema (core tables)

```sql
-- USERS & ROLES
profiles (id uuid PK references auth.users, full_name, phone, role text check (role in ('customer','admin','staff')), created_at)

-- MENU
menu_items (id uuid PK, name, description, price numeric, image_url, category text,
            calories int, tags text[], is_popular bool, is_available bool,
            prep_time_minutes int, created_at, updated_at)

-- ORDERS
orders (id uuid PK, customer_id uuid FK, status text check (status in
        ('received','preparing','ready','out_for_delivery','delivered','cancelled')),
        order_type text check (order_type in ('dine_in','pickup','delivery')),
        delivery_lat float8, delivery_lng float8, delivery_address text,
        subtotal numeric, discount_amount numeric, tax numeric, total numeric,
        payment_status text, payment_id text, razorpay_order_id text,
        placed_at timestamptz, updated_at timestamptz)

order_items (id uuid PK, order_id FK, menu_item_id FK, quantity int, unit_price numeric, notes text)

-- INVENTORY
inventory_items (id uuid PK, name, quantity numeric, unit text, min_level numeric,
                  cost_per_unit numeric, status text generated from quantity vs min_level)

-- STAFF
staff (id uuid PK, name, role text, phone, email, shift text, monthly_salary numeric, active bool)

-- FINANCE
expenses (id uuid PK, category text, amount numeric, note text, date date)
-- revenue is derived: SUM(orders.total) WHERE payment_status='paid', grouped by date

-- DISCOUNTS
discounts (id uuid PK, code text unique, type text check (type in ('percent','flat')),
           value numeric, min_order_value numeric, valid_from date, valid_to date,
           applicable_items uuid[], active bool)

-- REVIEWS
reviews (id uuid PK, customer_id FK, order_id FK, rating int check (rating between 1 and 5),
         comment text, created_at)

-- CAFE SETTINGS (singleton row — powers your "admin can replace photos/name" requirement)
cafe_settings (id int PK default 1, cafe_name text, tagline text, hero_image_url text,
               about_text text, phone text, email text, address text, address_lat float8,
               address_lng float8, facebook_url text, instagram_url text, twitter_url text)

-- AI / ANALYTICS SUPPORT
order_item_daily_counts (materialized view: date, menu_item_id, total_qty)
```

**Row-Level Security (must-do, not optional):**
- `orders`: customers can only see their own rows; admin/staff see all.
- `menu_items`, `discounts`, `cafe_settings`: public read, admin-only write.
- `staff`, `expenses`: admin-only read/write (never expose salaries to customer-facing queries).

---

## 4. Feature-by-Feature Build Plan

### 4.1 Customer-Facing Site
| Feature | What "done" looks like |
|---|---|
| Home + branding | Pulls `cafe_settings` row live — name, tagline, hero image, quotes all editable from admin, zero code changes needed |
| Menu browsing | Search bar (debounced), category filter chips, tag filter (Popular/Vegan/Spicy), skeleton loaders while fetching |
| Cart | Persisted in `localStorage`-free React Context (Supabase session-linked if logged in), quantity stepper, live subtotal |
| Checkout | Address autocomplete (Google Places) → pin drop confirmation on map → order type (Dine-in/Pickup/Delivery) → discount code field → Razorpay checkout |
| Order Tracking | Customer-facing page with live status via Supabase Realtime subscription — status pill updates without refresh (Received → Preparing → Ready → Delivered), plus a live map showing delivery rider position if you want to go further |
| Reviews | Only customers with a `delivered` order for that item can review (prevents fake reviews) |
| AI Recommendation | "Recommended for you" block calls an edge function that scores items by: customer's past orders + cart contents + global popularity |
| Chatbot | Floating widget, bottom-right, fed live menu + FAQ + order-status lookup |
| Notifications | On order placed → email + WhatsApp confirmation; on status change → WhatsApp update; admin-triggered offers → WhatsApp/email blast to opted-in customers |

### 4.2 Admin Panel
| Feature | What "done" looks like |
|---|---|
| Dashboard | Real revenue/expense/profit pulled from actual `orders` and `expenses` tables (currently showing ₹0 because no orders exist yet — this will populate once checkout is wired up) |
| Menu Items | Add/Edit/Delete with **image upload** (Supabase Storage, not just a pasted URL) or paste-URL fallback, toggle On/Off (controls `is_available`, hides from customer site instantly) |
| Orders & Kitchen | Kanban-style columns (Received/Preparing/Ready/Delivered) with drag-or-click status change → pushes Realtime update to customer instantly |
| Inventory | Add/Edit/Delete, auto low-stock badge when `quantity < min_level`, optional: auto-deduct stock when an order is placed (advanced, phase 2) |
| Staff | Add/Edit/Delete, shift + salary tracking, monthly payroll auto-sums from `staff.monthly_salary` |
| Discounts | Create % or flat discount codes, item-specific or store-wide, date range, active toggle |
| Expenses | Log expenses by category (rent, ingredients, utilities) — feeds Net Profit calc |
| Reviews | Moderate (hide inappropriate ones), reply publicly |
| Settings | Cafe name, tagline, hero image, about text, contact info, social links, **all editable and instantly reflected on the live site** — this already exists in your screenshots, just needs to be wired to the real `cafe_settings` table instead of local state |
| AI Popular Food Prediction | Table-driven prediction based on last 30 days of `order_item_daily_counts`, trending = week-over-week growth rate |
| Payments | View payment status per order, refund button (calls Razorpay refund API) |

---

## 5. Payments (Razorpay, ₹ INR)

1. Customer clicks "Pay Now" → your frontend calls an edge function `create-razorpay-order` → Razorpay returns an `order_id`.
2. Razorpay Checkout modal opens in the browser (UPI/Card/Netbanking).
3. On success, Razorpay sends a signed webhook to your `razorpay-webhook` edge function.
4. **Only trust the webhook, never the frontend callback**, to mark `payment_status = 'paid'` — this is the #1 mistake that lets people fake successful payments.
5. Order confirmation email/WhatsApp fires from the same webhook handler.

---

## 6. Location & Delivery Tracking

- Checkout: Google Places Autocomplete for address entry, with a draggable map pin so the customer can fine-tune the exact spot (important for gated communities / vague addresses).
- Store `delivery_lat` / `delivery_lng` on the order.
- Admin "Orders & Kitchen" view: a "View on Map" button opens the coordinates in an embedded map for the delivery staff.
- Phase 2 (optional, more complex): live rider tracking via a rider mobile view that pushes GPS updates to Supabase every ~10s, shown on the customer's tracking page.

---

## 7. Notifications (Email + WhatsApp)

- Customer opts in with phone/email at checkout or account creation.
- Triggers: order placed, status changes, new offer/discount published by admin.
- Build one edge function `send-notification` that accepts `{type, channel, order_id/customer_id, payload}` and routes to Resend (email) or Twilio/Gupshup (WhatsApp) — keeps all messaging logic in one place instead of scattered across the app.
- WhatsApp Business API requires template pre-approval for anything outside a 24-hour reply window — plan your message templates (order confirmation, status update, offer blast) early since approval can take a few days.

---

## 8. AI Recommendation & Popular Food Prediction (practical approach)

You don't need heavy ML for a single-cafe app — a transparent scoring model is faster to ship, cheaper to run, and easier to explain to a client than a black-box model.

**Recommendation score per item (per customer):**
```
score = (0.4 × times_ordered_by_this_customer)
      + (0.3 × global_popularity_last_30_days)
      + (0.2 × in_current_cart_category_match)
      + (0.1 × is_marked_popular)
```

**Popular Food Prediction (next week):**
```
growth_rate = (orders_this_week − orders_last_week) / orders_last_week
predicted_orders = orders_this_week × (1 + growth_rate)
confidence = min(95%, orders_this_week × 5%)   -- more historical data = higher confidence
```
This replaces the current flat "11 orders / 55% confidence" placeholder you have across every item (visible in your screenshots) with numbers that actually move once real orders start coming in.

If you want a true AI layer on top, use the OpenAI API only for the **chatbot** and for **natural-language upsell copy** ("Try our Herbal Wellness Tea — pairs perfectly with your Avocado Toast!") — not for the core math, which should stay deterministic and debuggable.

---

## 9. Chatbot

- System prompt includes: live menu (name, price, tags, description), FAQ (hours, delivery radius, allergen policy), and an order-status lookup tool (chatbot can query `orders` by order ID/phone).
- Keep it scoped — it should say "let me connect you to a human" for anything outside menu/order/hours questions, rather than guessing.

---

## 10. UI/UX Guidelines (to keep the "rich, attractive, dynamic" feel)

- **Color system**: keep your current sage-green + saffron-orange palette, but define it once as CSS variables (`--color-primary`, `--color-accent`, `--color-bg`) so admin theming is possible later without touching every component.
- **Motion**: Framer Motion for — hero text fade-up on load, menu cards lift-on-hover, cart slide-in drawer, toast notifications for "Added to cart" / "Order placed", animated counters on the Dashboard stat cards.
- **Typography**: keep the serif display font for headings (already in use — "Saffron & Sage" wordmark) paired with a clean sans-serif for body text, exactly as your screenshots show.
- **Rotating quotes banner** (already present — "Eat healthy, stay healthy…") — pull these from a `quotes` table so admin can add/edit without a redeploy.
- **Empty states**: your Orders/Dashboard screenshots currently show "No orders in this category" / "$0.00" — keep these friendly and on-brand rather than looking broken (you're already doing this well).

---

## 11. Testing & QA Checklist (to avoid client-facing errors)

- [ ] Every admin Add/Edit/Delete action shows a confirmation toast and reflects on the customer site within 1 refresh (or instantly via Realtime)
- [ ] Payment webhook tested with Razorpay test mode for success, failure, and refund
- [ ] Order status changes propagate to customer tracking page live
- [ ] Discount codes: expired codes rejected, min-order-value enforced, stacking rules decided (single code only, recommended)
- [ ] Inventory: low-stock badge triggers correctly at threshold
- [ ] Role security: log in as a plain customer account and confirm you *cannot* reach `/admin` routes or query staff/expenses tables directly
- [ ] Mobile responsiveness on checkout + map pin drop (most delivery orders will be on phones)
- [ ] WhatsApp/email templates tested end-to-end, not just "does the API call succeed"

---

## 12. Suggested Build Order (roadmap)

1. **Foundation**: Supabase project + schema above + RLS policies
2. **Wire existing Bolt frontend to real data** (menu, settings, staff, inventory — replace any hardcoded/local state)
3. **Auth**: customer signup/login + admin login (role-gated routes)
4. **Cart → Checkout → Razorpay** (this unlocks real revenue numbers on your Dashboard)
5. **Order tracking + Kitchen dashboard** via Supabase Realtime
6. **Notifications** (email first, WhatsApp second — email is faster to approve/ship)
7. **Discounts engine**
8. **Reviews**
9. **AI Recommendation + Popular Food Prediction** (scoring model from Section 8)
10. **Chatbot**
11. **Location/map polish + delivery tracking**
12. **QA pass using the checklist above, then deploy**

---

### Next step
Tell me which piece you want to start building first — I'd suggest **Section 3 (schema) + Section 4.1 wiring the existing frontend to Supabase**, since everything else (payments, tracking, AI) depends on that foundation being solid. I can generate the actual SQL migration file and the Supabase client setup code for you next.
