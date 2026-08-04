# Saffron & Sage — AI Cafe Management System

A full customer ordering site + admin management panel for a cafe, built with React + TypeScript + Tailwind on the frontend and Supabase (Postgres + Auth + Realtime) on the backend.

This is a **working starter project**, not just mockups — real database queries, real auth, real cart/checkout flow, live order-status updates. A few pieces (Razorpay payment capture, WhatsApp/email sending, the AI chatbot's brain) are wired up with clear `TODO` comments where you plug in your API keys, because those require accounts/credentials only you can create.

---

## 1. What's inside

```
cafe-management/
├── README.md                  ← you are here
├── supabase/
│   ├── schema.sql              ← run this first (tables + security rules)
│   └── seed.sql                 ← sample menu/staff/inventory data
├── src/
│   ├── lib/                     ← supabase client, Razorpay helper, AI scoring logic
│   ├── context/                 ← Auth (login/roles) and Cart state
│   ├── hooks/                   ← useMenu, useOrders (with live Realtime updates)
│   ├── components/               ← Navbar, Footer, ProductCard, Chatbot, etc.
│   ├── pages/                    ← customer-facing pages (Home, Menu, Cart, Checkout, Track Order, Reviews, About, Login)
│   └── pages/admin/               ← admin panel (Dashboard, Menu Items, Orders & Kitchen, Inventory, Staff, Discounts, Expenses, Reviews, Settings)
└── (config files: vite, tailwind, tsconfig, package.json)
```

---

## 2. Setup — step by step

### Step 1: Create a free Supabase project
1. Go to https://supabase.com → New Project.
2. Once it's ready, open **SQL Editor** and paste the contents of `supabase/schema.sql` → Run.
3. Then paste the contents of `supabase/seed.sql` → Run (this loads sample menu items, staff, and inventory so the app isn't empty on first load).
4. Go to **Project Settings → API** and copy your **Project URL** and **anon public key**.

### Step 2: Configure the project
```bash
cp .env.example .env
```
Open `.env` and paste in your Supabase URL + anon key. You can leave the Razorpay/Google Maps keys blank for now — the app will still run, those features just won't be live yet.

### Step 3: Install and run
```bash
npm install
npm run dev
```
Open the URL Vite prints (usually `http://localhost:5173`).

### Step 4: Create your admin account
1. On the running site, go to `/login` → sign up with an email + password like any customer would.
2. In Supabase, open **Table Editor → profiles**, find your new row, and change `role` from `customer` to `admin`.
3. Log out and back in — you'll now see the admin panel icon in the navbar, and `/admin` will be accessible.

You now have a fully working ordering site + admin panel talking to a real database.

---

## 3. What's fully working right now

- **Customer site**: browsing, search/filter, cart, discount code validation, order placement, live order tracking (Realtime — no page refresh needed), reviews list, About page pulling live cafe info.
- **Admin panel**: full Add/Edit/Delete on Menu Items, Inventory, Staff, Discounts, Expenses; Orders & Kitchen board with one-click status progression; Dashboard with real revenue/expense/profit math; Settings page that edits the live `cafe_settings` row (name, tagline, hero photo, contact, socials) — this is what replaces hardcoded values with something the cafe owner can change themselves without touching code.
- **Role-based security**: enforced at the database level via Supabase Row Level Security (not just hidden UI) — so a customer genuinely cannot read staff salaries or other people's orders, even by inspecting network requests.
- **AI Popular Food Prediction / Recommendation logic**: real, explainable scoring formulas in `src/lib/ai.ts` (see the build guide for the exact math) — they'll show real numbers once orders start flowing through the `orders` table instead of the placeholder 0s you'll see on a fresh install.

## 4. What needs your API keys to go fully live (marked with TODO comments in code)

| Feature | File | What to do |
|---|---|---|
| **Payments** | `src/pages/Checkout.tsx`, `src/lib/razorpay.ts` | Sign up at razorpay.com, get test keys, and deploy a `create-razorpay-order` Supabase Edge Function that creates the order server-side (never trust the amount from the browser) and a `razorpay-webhook` function that verifies payment and flips `payment_status` to `paid`. |
| **WhatsApp / Email notifications** | not yet stubbed — build a `send-notification` edge function per the main build guide | Sign up for Resend/SendGrid (email) and Twilio or Gupshup (WhatsApp Business API). |
| **Delivery address autocomplete + map pin** | `src/pages/Checkout.tsx` | Get a Google Maps API key, add the Places Autocomplete widget in place of the plain text input. |
| **AI Chatbot brain** | `src/components/Chatbot.tsx` | Currently shows a stub reply. Deploy an `ai-chatbot` edge function that sends the user's message + your live menu/FAQ to the OpenAI API and returns the real answer. |
| **Photo uploads** | `src/pages/admin/MenuItems.tsx`, `Settings.tsx` | Currently accepts a pasted image URL. Swap in a Supabase Storage upload button (a few lines of code) if you want the admin to upload files directly instead of hosting images elsewhere. |

None of these require rewriting anything — they're additive. The app works end-to-end without them; they just unlock the "real payments / real messages / real AI replies" layer.

---

## 5. Currency & locale
All prices are shown in ₹ (INR). The seed data converts the original demo prices at a rough ₹83/$1 rate — replace with your client's actual menu prices in the admin panel once live.

---

## 6. Deploying

- **Frontend**: push this repo to GitHub, connect it to Vercel or Netlify, add your `.env` values as environment variables in their dashboard, deploy.
- **Backend**: Supabase is already hosted — nothing to deploy, just keep using the same project.
- **Edge Functions** (payments, notifications, AI): `supabase functions deploy <name>` once you've written them (see Supabase docs — CLI setup takes ~5 minutes).

---

## 7. Where to go next
Refer back to the **AI-Cafe-Management-Build-Guide.md** document for the full architecture reasoning, database design rationale, and feature-by-feature spec this project was built from — useful when you (or another developer) extend it further.
