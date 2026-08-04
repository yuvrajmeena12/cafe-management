-- ============================================================
-- Migration: adds an optional cost_price to menu items, so the
-- AI Voice Assistant can answer real profit questions (not just
-- revenue), and ties naturally into the Profit Calculator.
-- Run this once in the SQL Editor on your existing project.
-- ============================================================

alter table menu_items add column if not exists cost_price numeric default 0;
