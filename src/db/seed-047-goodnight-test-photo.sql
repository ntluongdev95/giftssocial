-- seed-047-goodnight-test-photo.sql
-- Add a sample photo to the test daily-goodnight kiss so the reveal
-- can be checked with the photo-in-heart-shape rendered.
--
-- Uses picsum.photos (public random-image placeholder) so it works
-- without uploading anything to R2. Swap for a real photo URL when
-- testing with a specific image.

UPDATE kisses
SET template_data = json('{
  "name": "Minh Anh",
  "song": "https://www.youtube.com/watch?v=DWcJFNfaw9c",
  "photo": "https://picsum.photos/seed/goodnight-heart/600/600"
}')
WHERE id = 'kiss_test_goodnight_001';
