-- Seed 050: daily-goodnight-2 (Cloud Cuddle) template + test kiss.
--
--   Sender:   Hoa Nguyen (vn_ct_01)
--   Receiver: Minh Anh (user_0c414acb4b21c5cc = ntluongbn62@gmail.com)
--
-- Creates the template row, links it to the "daily" occasion, then
-- inserts a test kiss with 6 fake Picsum photos so the drifting
-- clouds each carry a distinct picture. A companion notification
-- appears in the receiver's inbox so they can tap → open → play.

-- ─── 1. Template row ─────────────────────────────────────────────────
INSERT OR REPLACE INTO templates (
  id, component_key, name, description, emoji, thumbnail_bg, accent_color,
  premium, coins, author,
  fields_schema, effects, active
) VALUES (
  'daily-goodnight-2',
  'daily-goodnight-2',
  'Good Night · Cloud Cuddle',
  'Cô gái nằm ngủ dưới bầu trời tím pastel, mây bồng bềnh chở ảnh của bạn bay ngang, "zzz" bay lên từ mái tóc.',
  '💤',
  'linear-gradient(135deg, #4c1d95, #c084fc, #f9a8d4)',
  '#c084fc',
  0, 0, 'gao',
  json('[
    {"key":"name",   "type":"text",       "label":"Their name",            "hint":"Written under the moon in cursive",           "required":true, "maxLength":40},
    {"key":"song",   "type":"audio-url",  "label":"Lullaby (optional)",    "hint":"YouTube / Spotify / TikTok link"},
    {"key":"photos", "type":"image",      "label":"Photos (up to 6)",      "hint":"Each cloud carries one photo across the sky"}
  ]'),
  NULL,
  1
);

-- ─── 2. Link to the "daily" occasion (sort after existing 5+1) ───
INSERT OR REPLACE INTO template_occasions (template_id, occasion_id, sort_order, featured)
VALUES ('daily-goodnight-2', 'daily', 6, 0);

-- ─── 3. Test kiss with 6 fake photos ─────────────────────────────
INSERT OR REPLACE INTO kisses (
  id, sender_id, receiver_id,
  message, emoji, visibility, kiss_type,
  sender_lat, sender_lng,
  receiver_lat, receiver_lng,
  opened, open_count, max_opens,
  template_id, template_data,
  created_at
) VALUES (
  'kiss_test_goodnight2_001',
  'vn_ct_01',
  'user_0c414acb4b21c5cc',
  'Ngủ ngon nhé em ơi ~ mai gặp em trong giấc mơ 💜',
  '💤',
  'public',
  'kiss',
  21.030, 105.850,
  21.011, 106.155,
  0, 0, 5,
  'daily-goodnight-2',
  json('{
    "name": "Minh Anh",
    "photos": [
      "https://picsum.photos/seed/gn2-cloud-1/400/400",
      "https://picsum.photos/seed/gn2-cloud-2/400/400",
      "https://picsum.photos/seed/gn2-cloud-3/400/400",
      "https://picsum.photos/seed/gn2-cloud-4/400/400",
      "https://picsum.photos/seed/gn2-cloud-5/400/400",
      "https://picsum.photos/seed/gn2-cloud-6/400/400"
    ]
  }'),
  datetime('now')
);

-- ─── 4. Notification so it appears in the inbox ─────────────
INSERT OR REPLACE INTO notifications (
  id, user_id, type, title, body, ref_type, ref_id, read, created_at
) VALUES (
  'ntf_test_goodnight2_001',
  'user_0c414acb4b21c5cc',
  'system',
  '💤 Hoa Nguyen gửi lời chúc ngủ ngon!',
  'Bầu trời đêm đang đợi bạn — nhấn để mở 🌙',
  'kiss',
  'kiss_test_goodnight2_001',
  0,
  datetime('now')
);
