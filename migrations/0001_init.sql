-- quitt — initial schema.
--
-- Two rules the schema enforces by shape:
--   1. Every monetary column is an INTEGER in the smallest currency unit.
--      The only REAL in the system is receipts.fx_rate_to_base.
--   2. The exchange rate is frozen per receipt, so a historical settlement
--      can never shift because today's rate moved.

PRAGMA foreign_keys = ON;

CREATE TABLE groups (
  id            TEXT PRIMARY KEY,
  space_token   TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'EUR',
  -- 'graph' resolves triangles (fewest payments); 'direct' nets pairwise only.
  netting_mode  TEXT NOT NULL DEFAULT 'graph' CHECK (netting_mode IN ('graph', 'direct')),
  -- Optional 4-digit PIN, stored as a SHA-256 hex digest. NULL = no PIN.
  pin_hash      TEXT,
  show_zetti    INTEGER NOT NULL DEFAULT 1,
  -- Bumped on every write so polling clients can diff cheaply.
  revision      INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE members (
  id           TEXT PRIMARY KEY,
  group_id     TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  color        TEXT NOT NULL,
  sort_order   INTEGER NOT NULL,
  archived     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE receipts (
  id              TEXT PRIMARY KEY,
  group_id        TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  payer_id        TEXT NOT NULL REFERENCES members (id) ON DELETE RESTRICT,
  merchant        TEXT,
  date            TEXT,
  note            TEXT,
  currency        TEXT NOT NULL,
  fx_rate_to_base REAL NOT NULL DEFAULT 1.0,
  fx_date         TEXT NOT NULL,
  total_cents     INTEGER NOT NULL,
  -- 'manual' | 'import' | 'travel'. Decides how raw_json is read back.
  source          TEXT NOT NULL DEFAULT 'manual',
  raw_json        TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE items (
  id            TEXT PRIMARY KEY,
  receipt_id    TEXT NOT NULL REFERENCES receipts (id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  -- The line exactly as printed, when it differs from the readable name.
  name_original TEXT,
  qty           REAL NOT NULL DEFAULT 1,
  total_cents   INTEGER NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('item', 'tax', 'tip', 'deposit', 'discount')),
  category      TEXT,
  sort_order    INTEGER NOT NULL
);

CREATE TABLE splits (
  id        TEXT PRIMARY KEY,
  item_id   TEXT NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  mode      TEXT NOT NULL CHECK (mode IN ('equal', 'shares', 'percent', 'fixed')),
  -- equal: ignored (stored as 1). shares: share count. percent: 0-100.
  -- fixed: amount in the smallest currency unit of the receipt.
  value     REAL NOT NULL,
  UNIQUE (item_id, member_id)
);

CREATE TABLE settlements (
  id           TEXT PRIMARY KEY,
  group_id     TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  from_id      TEXT NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  to_id        TEXT NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  settled_at   INTEGER NOT NULL
);

CREATE TABLE budgets (
  id           TEXT PRIMARY KEY,
  group_id     TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency     TEXT NOT NULL,
  period       TEXT NOT NULL CHECK (period IN ('once', 'weekly', 'monthly')),
  starts_on    TEXT NOT NULL,
  ends_on      TEXT,
  -- JSON array of category slugs, or NULL for "all categories".
  categories   TEXT,
  active       INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_members_group    ON members (group_id, sort_order);
CREATE INDEX idx_receipts_group   ON receipts (group_id, date DESC);
CREATE INDEX idx_items_receipt    ON items (receipt_id, sort_order);
CREATE INDEX idx_splits_item      ON splits (item_id);
CREATE INDEX idx_splits_member    ON splits (member_id);
CREATE INDEX idx_settle_group     ON settlements (group_id, settled_at DESC);
CREATE INDEX idx_budgets_group    ON budgets (group_id, active);
