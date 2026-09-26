-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS branches (
  id                  SERIAL PRIMARY KEY,
  slug                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  google_review_url   TEXT NOT NULL DEFAULT '',
  reward_text         TEXT NOT NULL DEFAULT 'Free drink',
  voucher_valid_hours INTEGER NOT NULL DEFAULT 24 CHECK (voucher_valid_hours > 0),
  cooldown_days       INTEGER NOT NULL DEFAULT 30 CHECK (cooldown_days >= 0),
  staff_pin_hash      TEXT,
  failed_pin_attempts INTEGER NOT NULL DEFAULT 0,
  pin_locked_until    TIMESTAMPTZ,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vouchers (
  id            SERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  branch_id     INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  phone         TEXT NOT NULL,
  reward_text   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  redeemed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS vouchers_branch_phone_idx ON vouchers (branch_id, phone, created_at DESC);
CREATE INDEX IF NOT EXISTS vouchers_branch_created_idx ON vouchers (branch_id, created_at DESC);

-- 'scan' = customer opened the QR page, 'review_click' = tapped the Google review button
CREATE TABLE IF NOT EXISTS events (
  id         BIGSERIAL PRIMARY KEY,
  branch_id  INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('scan', 'review_click')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_branch_type_idx ON events (branch_id, type, created_at);
