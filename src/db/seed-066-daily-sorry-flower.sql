-- Seed 066: daily-sorry-flower template + test kiss.
--
-- For now this is an EXACT copy of daily-sorry (id/component_key
-- differ so it registers separately) — the user will customize the
-- component at src/components/reveals/daily-sorry-flower/index.tsx
-- later. Keep this row in sync with seed-048-sorry-bear-hug.sql's
-- content until that customization happens.
--
-- 1. Insert the template row into `templates`
-- 2. Link it to the "daily" occasion via `template_occasions`
-- 3. Insert a companion test kiss so the receiver has something to open
-- 4. Insert a notification so it shows up in the notifications feed

-- ─── 1. Template row ─────────────────────────────────────────────────
INSERT OR REPLACE INTO templates (
  id, component_key, name, description, emoji, thumbnail_bg, accent_color,
  premium, coins, author,
  fields_schema, effects, active
) VALUES (
  'daily-sorry-flower',
  'daily-sorry-flower',
  'Sorry · Chiếc Nút Bất Khả Thi',
  'A chubby bear walks in with a "sorry" sign, drops it, opens arms for a hug — hearts burst around the embrace.',
  '🐻',
  'linear-gradient(135deg, #fed7c3, #fda4af, #f43f5e)',
  '#f43f5e',
  0, 0, 'gao',
  json('[
    {"key":"name",  "type":"text",  "label":"Their name",              "hint":"Written under the hug", "required":true, "maxLength":40},
    {"key":"song",  "type":"audio-url", "label":"Song (optional)",     "hint":"YouTube / Spotify / TikTok link"},
    {"key":"photo", "type":"image", "label":"A photo (optional)",      "hint":"Small polaroid to the side"}
  ]'),
  NULL,
  1
);

-- ─── 2. Link to the "daily" occasion (after existing 6 templates) ──
INSERT OR REPLACE INTO template_occasions (template_id, occasion_id, sort_order, featured)
VALUES ('daily-sorry-flower', 'daily', 7, 0);

-- ─── 3. Test kiss ─────────────────────────────────────────────────
-- Sender:   Hoa Nguyen (vn_ct_01)
-- Receiver: Minh Anh (user_0c414acb4b21c5cc = ntluongbn62@gmail.com)
INSERT OR REPLACE INTO kisses (
  id, sender_id, receiver_id,
  message, emoji, visibility, kiss_type,
  sender_lat, sender_lng,
  receiver_lat, receiver_lng,
  opened, open_count, max_opens,
  template_id, template_data,
  created_at
) VALUES (
  'kiss_test_sorry_flower_001',
  'vn_ct_01',
  'user_0c414acb4b21c5cc',
  'Hôm qua giận em vô cớ, anh sai rồi 🐻 Ôm em thật chặt để chuộc lỗi nhé!',
  '🐻',
  'public',
  'kiss',
  21.030, 105.850,        -- sender ≈ Hà Nội center
  21.011, 106.155,        -- receiver = Minh Anh (Bắc Ninh)
  0, 0, 5,
  'daily-sorry-flower',
  json('{
    "name": "Minh Anh",
    "photo": "https://picsum.photos/seed/sorry-bear/400/400"
  }'),
  datetime('now')
);

-- ─── 4. Notification for the receiver ────────────────────────────
INSERT OR REPLACE INTO notifications (
  id, user_id, type, title, body, ref_type, ref_id, read, created_at
) VALUES (
  'ntf_test_sorry_flower_001',
  'user_0c414acb4b21c5cc',
  'system',
  '🐻 Hoa Nguyen gửi lời xin lỗi!',
  'Có một chú gấu đang chờ ôm bạn — nhấn để mở 💕',
  'kiss',
  'kiss_test_sorry_flower_001',
  0,
  datetime('now')
);
