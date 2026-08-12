-- Seed 041: dev-only test kiss with distance in the CAR range (50–500km)
-- so the kiss reveal picks the car intro + on-map car animation.
--
-- Sender: Hoa Nguyen (vn_ct_01) — located near the receiver's home.
-- Receiver: Minh Anh (user_0c414acb4b21c5cc, ntluongbn62@gmail.com).
-- Distance: ~90 km (Ninh Bình → Bắc Ninh).

INSERT OR REPLACE INTO kisses (
  id, sender_id, receiver_id,
  message, emoji, visibility, kiss_type,
  sender_lat, sender_lng,
  receiver_lat, receiver_lng,
  opened, open_count, max_opens,
  template_id,
  created_at
) VALUES (
  'kiss_test_car_001',
  'vn_ct_01',
  'user_0c414acb4b21c5cc',
  'Test kiss for the CAR intro — should screech in with a Ferrari / Lambo / Porsche 🏎️',
  '💌',
  'private',
  'kiss',
  20.25, 105.97,    -- sender ~ Ninh Bình
  21.011, 106.155,  -- receiver = Minh Anh's actual location (Bắc Ninh)
  0, 0, 5,
  'val-love-letter',
  datetime('now')
);
