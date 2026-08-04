-- ============================================================
-- Migration: adds customer_name + customer_email to orders,
-- so we can send confirmation emails even for guest checkout
-- (i.e. customers who aren't logged in).
-- Run this once in the SQL Editor on your existing project.
-- ============================================================

alter table orders add column if not exists customer_name text;
alter table orders add column if not exists customer_email text;
