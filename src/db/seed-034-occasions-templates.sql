-- Seed 034: populate occasions + templates from src/lib/occasions.ts
--
-- Ports the 14 occasions + 17 templates that currently live in code
-- into the database so the frontend can source them from the API
-- instead of a hardcoded import. React components stay in code
-- (looked up via templates.component_key).

-- ─── occasions ──────────────────────────────────────────────────────────
INSERT INTO occasions (id, name, name_vi, emoji, theme_color, bg_gradient, description, date_month, date_day, is_lunar, evergreen, window_days, sort_order) VALUES
  ('valentine',          'Valentine''s Day',            'Lễ Tình Nhân',           '💝', '#ec4899', 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',                       'A day for love',                    2,  14, 0, 0, 21,  1),
  ('womens-day',         'International Women''s Day',  'Quốc tế Phụ nữ 8/3',    '🌷', '#f472b6', 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)',                       'Celebrate the women in your life', 3,   8, 0, 0, 14,  2),
  ('vietnam-womens-day', 'Vietnam Women''s Day',        'Phụ nữ Việt Nam 20/10',  '🌺', '#e11d48', 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)',                       'Celebrate Vietnamese women',       10, 20, 0, 0, 14,  3),
  ('mid-autumn',         'Mid-Autumn Festival',         'Tết Trung Thu',          '🥮', '#f97316', 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',                       'Moon cakes & lanterns',            9,  17, 1, 0, 14,  4),
  ('christmas',          'Christmas',                   'Giáng Sinh',             '🎄', '#dc2626', 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 50%, #dcfce7 100%)',          'The season of giving',            12, 25, 0, 0, 30,  5),
  ('tet',                'Lunar New Year',              'Tết Nguyên Đán',         '🧧', '#dc2626', 'linear-gradient(135deg, #fef2f2 0%, #fca5a5 50%, #fbbf24 100%)',          'Ring in the Lunar New Year',       1,  29, 1, 0, 30,  6),
  ('birthday',           'Birthday',                    NULL,                      '🎂', '#f97316', 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',                       'Happy birthday wishes',           NULL, NULL, 0, 1, 0,  7),
  ('sorry',              'Sorry',                       NULL,                      '🙏', '#8b5cf6', 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',                       'Say you''re sorry',               NULL, NULL, 0, 1, 0,  8),
  ('proposal',           'Proposal',                    NULL,                      '💍', '#f43f5e', 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',                       'Will you marry me?',              NULL, NULL, 0, 1, 0,  9),
  ('anniversary',        'Anniversary',                 NULL,                      '💑', '#ec4899', 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',                       'Celebrate your milestones',       NULL, NULL, 0, 1, 0, 10),
  ('congrats',           'Congrats',                    NULL,                      '🎉', '#eab308', 'linear-gradient(135deg, #fefce8 0%, #fef08a 100%)',                       'Cheers to your win',              NULL, NULL, 0, 1, 0, 11),
  ('thank-you',          'Thank You',                   NULL,                      '🙌', '#14b8a6', 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',                       'Show your appreciation',          NULL, NULL, 0, 1, 0, 12),
  ('miss-you',           'Miss You',                    NULL,                      '💌', '#a855f7', 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',                       'Thinking of you',                 NULL, NULL, 0, 1, 0, 13),
  ('get-well',           'Get Well',                    NULL,                      '🌸', '#22c55e', 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',                       'Wishing a speedy recovery',       NULL, NULL, 0, 1, 0, 14);

-- ─── templates ──────────────────────────────────────────────────────────
-- component_key must match a folder in src/components/reveals/[key]/
-- Only 'rose-rain' currently has a React component; the rest are
-- registered as legacy placeholders (fall back to default reveal on send).

INSERT INTO templates (id, component_key, name, description, emoji, thumbnail_bg, accent_color, premium, coins, author) VALUES
  -- Valentine
  ('rose-rain',       'rose-rain',       'Rose Rain',        'Red rose petals cascade across the screen while a love letter fades in over a dark romantic backdrop.', '🌹', 'linear-gradient(135deg, #fecdd3, #f43f5e)', '#f43f5e', 0,  0, 'gao'),
  ('val-heart-blast', 'default',         'Heart Explosion',  'A giant heart bursts open into hundreds of tiny hearts + sparkles.',                                     '💥', 'linear-gradient(135deg, #fbcfe8, #ec4899)', '#ec4899', 0,  0, 'gao'),
  ('val-love-letter', 'default',         'Love Letter',      'An envelope flies in, seals itself with a wax heart, then unfolds your message.',                        '💌', 'linear-gradient(135deg, #fef3c7, #f472b6)', '#f472b6', 1, 20, 'gao'),
  ('val-starry',      'default',         'Starry Night',     'Two silhouettes under a starry sky — shooting stars spell "I love you".',                               '✨', 'linear-gradient(135deg, #1e293b, #6366f1)', '#6366f1', 1, 30, 'gao'),
  -- Birthday
  ('bday-party',      'default',         'Party Popper',     'Confetti bursts from every direction, balloons drift up.',                                              '🎉', 'linear-gradient(135deg, #fef3c7, #f97316)', '#f97316', 0,  0, 'gao'),
  ('bday-candles',    'default',         'Elegant Candles',  'Soft candle glow around a golden cake — quiet birthday wish.',                                          '🕯️', 'linear-gradient(135deg, #fef3c7, #d97706)', '#d97706', 0,  0, 'gao'),
  ('bday-balloons',   'default',         'Balloon Rain',     'Colorful balloons rain down, dove delivers wrapped gift.',                                              '🎈', 'linear-gradient(135deg, #dbeafe, #ec4899)', '#ec4899', 0,  0, 'gao'),
  ('bday-cake',       'default',         'Cake Reveal',      'Cinematic cake reveal with slow-mo candle blow-out.',                                                   '🎂', 'linear-gradient(135deg, #fce7f3, #db2777)', '#db2777', 1, 25, 'gao'),
  -- Christmas
  ('xmas-snow',       'default',         'Snow Fall',        'Soft snowflakes drift down over a warmly lit tree.',                                                    '❄️', 'linear-gradient(135deg, #e0e7ff, #6366f1)', '#6366f1', 0,  0, 'gao'),
  ('xmas-santa',      'default',         'Santa Delivery',   'Santa flies past in his sleigh dropping a wrapped gift.',                                               '🎅', 'linear-gradient(135deg, #dcfce7, #dc2626)', '#dc2626', 0,  0, 'gao'),
  ('xmas-fireplace',  'default',         'Fireplace',        'A cozy fireplace with stockings — flames flicker warmly.',                                              '🔥', 'linear-gradient(135deg, #fee2e2, #dc2626)', '#dc2626', 1, 15, 'gao'),
  -- Sorry
  ('sorry-white',     'default',         'White Rose',       'A single white rose drifts down over a subtle apology note.',                                           '🌹', 'linear-gradient(135deg, #f5f3ff, #a78bfa)', '#a78bfa', 0,  0, 'gao'),
  ('sorry-note',      'default',         'Heartfelt Note',   'A handwritten "I''m sorry" letter unfolds slowly.',                                                     '💌', 'linear-gradient(135deg, #ede9fe, #8b5cf6)', '#8b5cf6', 0,  0, 'gao'),
  ('sorry-origami',   'default',         'Origami Crane',    'A paper crane folds itself with your message inside.',                                                  '🕊️', 'linear-gradient(135deg, #f3e8ff, #7c3aed)', '#7c3aed', 1, 20, 'gao'),
  -- Proposal
  ('prop-ring',       'default',         'Ring Reveal',      'Ring box slowly opens, diamond sparkles fill the screen.',                                              '💍', 'linear-gradient(135deg, #fff1f2, #f43f5e)', '#f43f5e', 0,  0, 'gao'),
  ('prop-stars',      'default',         'Under the Stars',  'Night sky reveals "Will you marry me?" written in stars.',                                              '⭐', 'linear-gradient(135deg, #1e293b, #f43f5e)', '#f43f5e', 1, 40, 'gao'),
  ('prop-petals',     'default',         'Petal Path',       'A trail of rose petals leads to a shining ring at the end.',                                            '🌹', 'linear-gradient(135deg, #ffe4e6, #e11d48)', '#e11d48', 1, 30, 'gao');

-- ─── template_occasions (many-to-many mapping) ──────────────────────────
INSERT INTO template_occasions (template_id, occasion_id, sort_order, featured) VALUES
  ('rose-rain',       'valentine',   1, 1),
  ('val-heart-blast', 'valentine',   2, 0),
  ('val-love-letter', 'valentine',   3, 0),
  ('val-starry',      'valentine',   4, 0),
  ('bday-party',      'birthday',    1, 1),
  ('bday-candles',    'birthday',    2, 0),
  ('bday-balloons',   'birthday',    3, 0),
  ('bday-cake',       'birthday',    4, 0),
  ('xmas-snow',       'christmas',   1, 1),
  ('xmas-santa',      'christmas',   2, 0),
  ('xmas-fireplace',  'christmas',   3, 0),
  ('sorry-white',     'sorry',       1, 1),
  ('sorry-note',      'sorry',       2, 0),
  ('sorry-origami',   'sorry',       3, 0),
  ('prop-ring',       'proposal',    1, 1),
  ('prop-stars',      'proposal',    2, 0),
  ('prop-petals',     'proposal',    3, 0);
