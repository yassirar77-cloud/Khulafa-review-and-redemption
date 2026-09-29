-- Safe to run more than once.
-- Everything lives in its own "review" schema so it can share a database
-- with other apps without touching their tables.

CREATE SCHEMA IF NOT EXISTS review;

CREATE TABLE IF NOT EXISTS review.branches (
  id                  SERIAL PRIMARY KEY,
  slug                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  google_review_url   TEXT NOT NULL DEFAULT '',
  reward_text         TEXT NOT NULL DEFAULT 'Free drink',
  reward_note         TEXT NOT NULL DEFAULT '',
  voucher_valid_hours INTEGER NOT NULL DEFAULT 24 CHECK (voucher_valid_hours > 0),
  cooldown_days       INTEGER NOT NULL DEFAULT 30 CHECK (cooldown_days >= 0),
  staff_pin_hash      TEXT,
  failed_pin_attempts INTEGER NOT NULL DEFAULT 0,
  pin_locked_until    TIMESTAMPTZ,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Added after launch; keeps older databases in step with the table above.
ALTER TABLE review.branches ADD COLUMN IF NOT EXISTS reward_note TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS review.vouchers (
  id            SERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  branch_id     INTEGER NOT NULL REFERENCES review.branches(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  phone         TEXT NOT NULL,
  reward_text   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  redeemed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS vouchers_branch_phone_idx ON review.vouchers (branch_id, phone, created_at DESC);
CREATE INDEX IF NOT EXISTS vouchers_branch_created_idx ON review.vouchers (branch_id, created_at DESC);

-- 'scan' = customer opened the QR page, 'review_click' = tapped the Google review button
CREATE TABLE IF NOT EXISTS review.events (
  id         BIGSERIAL PRIMARY KEY,
  branch_id  INTEGER NOT NULL REFERENCES review.branches(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('scan', 'review_click')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_branch_type_idx ON review.events (branch_id, type, created_at);

-- The app connects directly as the database owner. Row level security with no
-- policies keeps these tables closed to Supabase's public API keys.
ALTER TABLE review.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE review.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE review.events ENABLE ROW LEVEL SECURITY;
