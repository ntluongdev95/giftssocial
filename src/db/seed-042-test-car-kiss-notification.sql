-- Seed 042: notification for the test car kiss (kiss_test_car_001) so
-- Minh Anh sees it in the notifications feed and can tap through to
-- open the reveal.
--
-- Matches the shape used by src/lib/notify.ts for real kiss-arrivals:
--   type='system', ref_type='kiss', ref_id=<kiss_id>, unread by default.

INSERT OR REPLACE INTO notifications (
  id, user_id, type, title, body, ref_type, ref_id, read, created_at
) VALUES (
  'ntf_test_car_kiss_001',
  'user_0c414acb4b21c5cc',
  'system',
  '💌 Hoa Nguyen sent you a kiss!',
  'Open it on the map 🎁✨',
  'kiss',
  'kiss_test_car_001',
  0,
  datetime('now')
);
