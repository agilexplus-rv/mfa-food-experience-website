-- Phase 6 schema migrations for Turso/libSQL (demo) and PostgreSQL (production)
-- Run these statements against your database before deploying Phase 6.
-- All statements are idempotent (safe to re-run).

-- Bookings: new fields for refund tracking and no-show
ALTER TABLE bookings ADD COLUMN stripe_refund_id TEXT;
ALTER TABLE bookings ADD COLUMN refund_status TEXT DEFAULT 'none';
ALTER TABLE bookings ADD COLUMN no_show INTEGER DEFAULT 0;

-- Users: active flag for staff deactivation
ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1;

-- Policies: version tracking fields
ALTER TABLE policies ADD COLUMN version TEXT;
ALTER TABLE policies ADD COLUMN reviewed_at TEXT;

-- Waitlist: new table for event waitlists
CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    persons INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'waiting',
    notified_at TEXT,
    updated_at TEXT,
    created_at TEXT
);
