-- ─── Migration: extend notifications.type CHECK to include capsule events ───
-- Adds 'capsule_received' (someone sent you a capsule) and 'capsule_opened'
-- (a recipient opened your capsule). SQLite cannot ALTER a CHECK constraint
-- in place, so we recreate the table.

CREATE TABLE notifications_new (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  type              TEXT NOT NULL
                    CHECK (type IN (
                      'booking_confirmed', 'booking_reminder', 'booking_canceled',
                      'event_reminder', 'event_starting',
                      'signal_response', 'signal_matched',
                      'circle_invite', 'circle_activity', 'circle_join_request',
                      'proof_earned', 'trust_upgraded',
                      'review_received', 'follow_new', 'new_message',
                      'capsule_received', 'capsule_opened',
                      'system'
                    )),
  title             TEXT NOT NULL,
  body              TEXT DEFAULT '',
  ref_type          TEXT,
  ref_id            TEXT,
  read              INTEGER DEFAULT 0,
  seen              INTEGER DEFAULT 0,
  created_at        TEXT DEFAULT (datetime('now'))
);

INSERT INTO notifications_new (id, user_id, type, title, body, ref_type, ref_id, read, seen, created_at)
  SELECT id, user_id, type, title, body, ref_type, ref_id, read, seen, created_at
  FROM notifications;

DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;

CREATE INDEX IF NOT EXISTS idx_ntf_user ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ntf_type ON notifications(type);
