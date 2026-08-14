-- Seed 045: test kiss for the daily-goodnight template.
--
-- Sender:   Hoa Nguyen (vn_ct_01) — nearby so intro plays the dove vehicle
-- Receiver: Minh Anh (user_0c414acb4b21c5cc = ntluongbn62@gmail.com)
-- Template: daily-goodnight → cinematic blackhole → personal universe
--
-- Template data includes:
--   name = "Minh Anh"  → becomes the constellation-name label + planet caption
--   song = YouTube ambient sleep music → tap-to-play pill top-left
-- Photo field left empty on purpose — the reveal falls back to the
-- pastel nebula-style procedural planet texture so you can see how it
-- looks WITHOUT a user photo. Add "photo": "<url>" here if you want to
-- test the photo-as-planet path.

INSERT OR REPLACE INTO kisses (
  id, sender_id, receiver_id,
  message, emoji, visibility, kiss_type,
  sender_lat, sender_lng,
  receiver_lat, receiver_lng,
  opened, open_count, max_opens,
  template_id, template_data,
  created_at
) VALUES (
  'kiss_test_goodnight_001',
  'vn_ct_01',
  'user_0c414acb4b21c5cc',
  'Ngủ ngon nhé, mai gặp em ở giấc mơ 💜 Chúc em một đêm bình yên.',
  '🌙',
  'public',
  'kiss',
  21.030, 105.850,   -- sender ≈ Hà Nội center
  21.011, 106.155,   -- receiver = Minh Anh (Bắc Ninh) — ~30km → dove vehicle
  0, 0, 5,
  'daily-goodnight',
  json('{
    "name": "Minh Anh",
    "song": "https://www.youtube.com/watch?v=DWcJFNfaw9c"
  }'),
  datetime('now')
);

-- Companion notification so it appears in the notifications feed.
INSERT OR REPLACE INTO notifications (
  id, user_id, type, title, body, ref_type, ref_id, read, created_at
) VALUES (
  'ntf_test_goodnight_001',
  'user_0c414acb4b21c5cc',
  'system',
  '🌙 Hoa Nguyen chúc bạn ngủ ngon!',
  'Bạn có một kiss chờ khám phá — nhấn để mở ✨',
  'kiss',
  'kiss_test_goodnight_001',
  0,
  datetime('now')
);
