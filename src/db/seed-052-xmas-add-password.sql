-- Seed 052: add password lock to the Christmas test kiss.
--
-- KissReplayOverlay already reads `template_data.password` +
-- `template_data.password_hint` — when present the flying step hands
-- off to PasswordLock, which only advances to the template reveal
-- once the code is entered correctly. Adding these two fields to the
-- xmas test kiss is enough to make the door appear.
--
-- Password: "2512"  (25/12 · Christmas Day)
-- Hint:     "Ngày Giáng sinh (dd/mm)"

UPDATE kisses
SET template_data = json('{
  "name": "Minh Anh",
  "password": "2512",
  "password_hint": "Ngày Giáng sinh (dd/mm)",
  "photos": [
    "https://picsum.photos/seed/xmas-1/400/400",
    "https://picsum.photos/seed/xmas-2/400/400",
    "https://picsum.photos/seed/xmas-3/400/400",
    "https://picsum.photos/seed/xmas-4/400/400",
    "https://picsum.photos/seed/xmas-5/400/400",
    "https://picsum.photos/seed/xmas-6/400/400"
  ]
}')
WHERE id = 'kiss_test_xmas_001';

-- Reset notification so user gets a fresh unread ping
UPDATE notifications
SET read = 0
WHERE id = 'ntf_test_xmas_001';
