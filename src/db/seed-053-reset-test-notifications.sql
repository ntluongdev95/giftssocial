-- seed-053: Reset all test kiss notifications to UNREAD + reset kiss
-- open counters so they can be tested fresh from the notifications
-- feed. Also clears the KV cache keys so the /api/v1/kisses/:id
-- endpoint refetches from DB (fresh template_data with password etc).

UPDATE notifications
SET read = 0
WHERE id IN (
  'ntf_test_xmas_001',
  'ntf_test_bday_001',
  'ntf_test_tet_001',
  'ntf_test_sorry_001',
  'ntf_test_goodnight_001',
  'ntf_test_goodnight2_001'
);

-- Reset kiss opened counters so replay is clean
UPDATE kisses
SET opened = 0, open_count = 0
WHERE id IN (
  'kiss_test_xmas_001',
  'kiss_test_bday_001',
  'kiss_test_tet_001',
  'kiss_test_sorry_001',
  'kiss_test_goodnight_001',
  'kiss_test_goodnight2_001'
);
