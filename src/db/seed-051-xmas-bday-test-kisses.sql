-- Seed 051: test kisses + notifications for the featured templates of
-- the Christmas + Birthday occasions.
--
--   • xmas-snow    → featured template #1 of the christmas occasion
--   • bday-journey → featured template #1 of the birthday occasion
--
-- Same sender/receiver as the existing test seeds:
--   Sender:   Hoa Nguyen (vn_ct_01)
--   Receiver: Minh Anh (user_0c414acb4b21c5cc = ntluongbn62@gmail.com)
--
-- Both kisses include 6 fake Picsum photos so any gallery-style layer
-- inside the template can render meaningful content.

-- ─── 1. Christmas · xmas-snow ───────────────────────────────────
INSERT OR REPLACE INTO kisses (
  id, sender_id, receiver_id,
  message, emoji, visibility, kiss_type,
  sender_lat, sender_lng,
  receiver_lat, receiver_lng,
  opened, open_count, max_opens,
  template_id, template_data,
  created_at
) VALUES (
  'kiss_test_xmas_001',
  'vn_ct_01',
  'user_0c414acb4b21c5cc',
  'Merry Christmas em iu 🎄 Món quà lớn nhất năm nay của anh là được có em bên cạnh.',
  '🎄',
  'public',
  'kiss',
  21.030, 105.850,
  21.011, 106.155,
  0, 0, 5,
  'xmas-snow',
  json('{
    "name": "Minh Anh",
    "photos": [
      "https://picsum.photos/seed/xmas-1/400/400",
      "https://picsum.photos/seed/xmas-2/400/400",
      "https://picsum.photos/seed/xmas-3/400/400",
      "https://picsum.photos/seed/xmas-4/400/400",
      "https://picsum.photos/seed/xmas-5/400/400",
      "https://picsum.photos/seed/xmas-6/400/400"
    ]
  }'),
  datetime('now')
);

INSERT OR REPLACE INTO notifications (
  id, user_id, type, title, body, ref_type, ref_id, read, created_at
) VALUES (
  'ntf_test_xmas_001',
  'user_0c414acb4b21c5cc',
  'system',
  '🎄 Hoa Nguyen gửi quà Giáng sinh!',
  'Có tuyết đang rơi cho bạn — nhấn để mở ❄️',
  'kiss',
  'kiss_test_xmas_001',
  0,
  datetime('now')
);

-- ─── 2. Birthday · bday-journey ─────────────────────────────────
INSERT OR REPLACE INTO kisses (
  id, sender_id, receiver_id,
  message, emoji, visibility, kiss_type,
  sender_lat, sender_lng,
  receiver_lat, receiver_lng,
  opened, open_count, max_opens,
  template_id, template_data,
  created_at
) VALUES (
  'kiss_test_bday_001',
  'vn_ct_01',
  'user_0c414acb4b21c5cc',
  'Chúc mừng sinh nhật em iu 🎂 Cảm ơn em vì đã tồn tại trong đời anh. Yêu em nhất!',
  '🎂',
  'public',
  'kiss',
  21.030, 105.850,
  21.011, 106.155,
  0, 0, 5,
  'bday-journey',
  json('{
    "name": "Minh Anh",
    "age": 25,
    "photos": [
      "https://picsum.photos/seed/bday-1/400/400",
      "https://picsum.photos/seed/bday-2/400/400",
      "https://picsum.photos/seed/bday-3/400/400",
      "https://picsum.photos/seed/bday-4/400/400",
      "https://picsum.photos/seed/bday-5/400/400",
      "https://picsum.photos/seed/bday-6/400/400"
    ]
  }'),
  datetime('now')
);

INSERT OR REPLACE INTO notifications (
  id, user_id, type, title, body, ref_type, ref_id, read, created_at
) VALUES (
  'ntf_test_bday_001',
  'user_0c414acb4b21c5cc',
  'system',
  '🎂 Hoa Nguyen chúc mừng sinh nhật!',
  'Có một hành trình sinh nhật đang chờ bạn — nhấn để mở 🎉',
  'kiss',
  'kiss_test_bday_001',
  0,
  datetime('now')
);

-- ─── 3. Lunar New Year · tet ────────────────────────────────────
-- No template is linked to the `tet` occasion yet, so we link the
-- snowy xmas-snow template (winter festive vibe fits Tết) and use it
-- as the New Year test. Also inserts the featured link row so `tet`
-- has a template available.
INSERT OR REPLACE INTO template_occasions (template_id, occasion_id, sort_order, featured)
VALUES ('xmas-snow', 'tet', 0, 1);

INSERT OR REPLACE INTO kisses (
  id, sender_id, receiver_id,
  message, emoji, visibility, kiss_type,
  sender_lat, sender_lng,
  receiver_lat, receiver_lng,
  opened, open_count, max_opens,
  template_id, template_data,
  created_at
) VALUES (
  'kiss_test_tet_001',
  'vn_ct_01',
  'user_0c414acb4b21c5cc',
  'Chúc mừng năm mới em iu 🧧 An khang thịnh vượng, vạn sự như ý — và luôn có anh bên cạnh!',
  '🧧',
  'public',
  'kiss',
  21.030, 105.850,
  21.011, 106.155,
  0, 0, 5,
  'xmas-snow',
  json('{
    "name": "Minh Anh",
    "photos": [
      "https://picsum.photos/seed/tet-1/400/400",
      "https://picsum.photos/seed/tet-2/400/400",
      "https://picsum.photos/seed/tet-3/400/400",
      "https://picsum.photos/seed/tet-4/400/400",
      "https://picsum.photos/seed/tet-5/400/400",
      "https://picsum.photos/seed/tet-6/400/400"
    ]
  }'),
  datetime('now')
);

INSERT OR REPLACE INTO notifications (
  id, user_id, type, title, body, ref_type, ref_id, read, created_at
) VALUES (
  'ntf_test_tet_001',
  'user_0c414acb4b21c5cc',
  'system',
  '🧧 Hoa Nguyen chúc mừng năm mới!',
  'Có bao lì xì đang bay tới — nhấn để mở 🎊',
  'kiss',
  'kiss_test_tet_001',
  0,
  datetime('now')
);
