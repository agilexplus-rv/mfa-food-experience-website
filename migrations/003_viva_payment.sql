-- Phase 7 (VIVA Wallet) schema migrations for PostgreSQL
-- Run these statements against your database before deploying the VIVA switch.
-- All statements are idempotent (safe to re-run).

-- Bookings: new VIVA Wallet fields
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS viva_order_code TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS viva_transaction_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS viva_refund_id TEXT;

-- Bookings: update payment_method default (not strictly necessary, but ensures
-- new bookings created without an explicit payment_method get 'viva')
ALTER TABLE bookings ALTER COLUMN payment_method SET DEFAULT 'viva';

-- Note: the stripe_checkout_session_id, stripe_payment_intent_id, and
-- stripe_refund_id columns are retained for legacy data. They are not
-- removed. stripe and viva fields coexist.