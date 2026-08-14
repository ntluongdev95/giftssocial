-- seed-049-sorry-6-photos.sql
-- Fake 6 photos for the test sorry kiss so Chapter 3's gallery
-- collage can be visually verified. Uses picsum.photos with 6
-- different seeds so every polaroid shows a distinct random image.
--
-- template_data.photos = array of URLs (up to 6). template_data.photo
-- (single) is kept for Chapter 2's tap-collect targets — that game
-- uses ONE photo so the same face appears on every flying heart.

UPDATE kisses
SET template_data = json('{
  "name":   "Minh Anh",
  "photo":  "https://picsum.photos/seed/sorry-bear/400/400",
  "photos": [
    "https://picsum.photos/seed/sorry-photo-1/400/400",
    "https://picsum.photos/seed/sorry-photo-2/400/400",
    "https://picsum.photos/seed/sorry-photo-3/400/400",
    "https://picsum.photos/seed/sorry-photo-4/400/400",
    "https://picsum.photos/seed/sorry-photo-5/400/400",
    "https://picsum.photos/seed/sorry-photo-6/400/400"
  ]
}')
WHERE id = 'kiss_test_sorry_001';
