-- ============================================================================
-- Gao Social V3 — Local Dev Seed Data
-- ============================================================================

-- ── Users (fake profiles to populate) ──────────────────────────────────
INSERT OR IGNORE INTO users (id, username, display_name, email, avatar_url, bio, city, location_lat, location_lng, trust_score, trust_level, badges, role, status, last_seen_at, created_at, updated_at) VALUES
('user_seed_01', 'anna_nguyen', 'Anna Nguyen', 'anna@example.com', '', 'Full-stack developer & coffee addict', 'Ho Chi Minh City', 10.7769, 106.7009, 78, 'trusted', '["verified","active_community"]', 'normal', 'active', datetime('now', '-5 minutes'), datetime('now', '-30 days'), datetime('now')),
('user_seed_02', 'mike_tran', 'Mike Tran', 'mike@example.com', '', 'Crypto enthusiast | Building Web3', 'Hanoi', 21.0285, 105.8542, 65, 'verified', '["verified"]', 'normal', 'active', datetime('now', '-15 minutes'), datetime('now', '-45 days'), datetime('now')),
('user_seed_03', 'sarah_le', 'Sarah Le', 'sarah@example.com', '', 'UX Designer @ Toii Labs', 'Ho Chi Minh City', 10.7800, 106.6950, 85, 'trusted', '["verified","trusted_seller"]', 'normal', 'active', datetime('now', '-2 minutes'), datetime('now', '-60 days'), datetime('now')),
('user_seed_04', 'david_pham', 'David Pham', 'david@example.com', '', 'Foodie | Travel | Photography', 'Da Nang', 16.0544, 108.2022, 50, 'verified', '[]', 'normal', 'active', datetime('now', '-30 minutes'), datetime('now', '-20 days'), datetime('now')),
('user_seed_05', 'linh_vo', 'Linh Vo', 'linh@example.com', '', 'Yoga instructor & wellness coach', 'Ho Chi Minh City', 10.7730, 106.7050, 72, 'trusted', '["verified"]', 'normal', 'active', datetime('now', '-8 minutes'), datetime('now', '-90 days'), datetime('now'));

-- ── Businesses ──────────────────────────────────────────────────────────
INSERT OR IGNORE INTO businesses (id, owner_user_id, name, category, description, location_lat, location_lng, address, city, phone, hours, booking_enabled, cover_image, images, services, subcategories, trust_score, trust_level, badges, rating_avg, rating_count, proof_count, status, created_at, updated_at) VALUES
('biz_seed_01', 'user_seed_01', 'The Coffee House', 'Food & Drink', 'Premium Vietnamese coffee. Specialty drinks, quiet workspace, fast wifi.', 10.7769, 106.7009, '42 Nguyen Hue, District 1', 'Ho Chi Minh City', '+84 28 1234 5678', '{"Mon":{"open":"07:00","close":"22:00"},"Tue":{"open":"07:00","close":"22:00"},"Wed":{"open":"07:00","close":"22:00"},"Thu":{"open":"07:00","close":"22:00"},"Fri":{"open":"07:00","close":"23:00"},"Sat":{"open":"08:00","close":"23:00"},"Sun":{"open":"08:00","close":"21:00"}}', 1, '', '[]', '[{"name":"Cappuccino","price":3.5,"duration":5},{"name":"Phin Sua Da","price":2.5,"duration":5},{"name":"Matcha Latte","price":4.0,"duration":5}]', '["Coffee","Tea","Workspace"]', 82, 'trusted', '["verified","popular"]', 4.6, 128, 23, 'active', datetime('now', '-60 days'), datetime('now')),

('biz_seed_02', 'user_seed_03', 'Zen Yoga Studio', 'Health & Fitness', 'Hot yoga, vinyasa flow, meditation. All levels welcome.', 10.7800, 106.6950, '15 Le Loi, District 1', 'Ho Chi Minh City', '+84 28 9876 5432', '{"Mon":{"open":"06:00","close":"21:00"},"Tue":{"open":"06:00","close":"21:00"},"Wed":{"open":"06:00","close":"21:00"},"Thu":{"open":"06:00","close":"21:00"},"Fri":{"open":"06:00","close":"21:00"},"Sat":{"open":"07:00","close":"18:00"},"Sun":{"open":"07:00","close":"18:00"}}', 1, '', '[]', '[{"name":"Drop-in Class","price":12,"duration":60},{"name":"Monthly Pass","price":80,"duration":0},{"name":"Private Session","price":35,"duration":60}]', '["Yoga","Meditation","Wellness"]', 75, 'trusted', '["verified"]', 4.8, 86, 15, 'active', datetime('now', '-45 days'), datetime('now')),

('biz_seed_03', 'user_seed_04', 'Banh Mi Bay', 'Food & Drink', 'Authentic banh mi with a modern twist. Fresh ingredients daily.', 10.7750, 106.7020, '88 Bui Vien, District 1', 'Ho Chi Minh City', '+84 28 5555 1234', '{"Mon":{"open":"06:30","close":"22:00"},"Tue":{"open":"06:30","close":"22:00"},"Wed":{"open":"06:30","close":"22:00"},"Thu":{"open":"06:30","close":"22:00"},"Fri":{"open":"06:30","close":"23:00"},"Sat":{"open":"07:00","close":"23:00"},"Sun":{"open":"07:00","close":"21:00"}}', 0, '', '[]', '[]', '["Vietnamese","Street Food","Sandwiches"]', 60, 'verified', '[]', 4.4, 210, 45, 'active', datetime('now', '-30 days'), datetime('now')),

('biz_seed_04', 'user_seed_02', 'Tech Hub Coworking', 'Services', 'Premium coworking space. Meeting rooms, event space, 24/7 access.', 10.7820, 106.6980, '120 Pasteur, District 3', 'Ho Chi Minh City', '+84 28 7777 8888', '{"Mon":{"open":"00:00","close":"23:59"},"Tue":{"open":"00:00","close":"23:59"},"Wed":{"open":"00:00","close":"23:59"},"Thu":{"open":"00:00","close":"23:59"},"Fri":{"open":"00:00","close":"23:59"},"Sat":{"open":"08:00","close":"22:00"},"Sun":{"open":"08:00","close":"20:00"}}', 1, '', '[]', '[{"name":"Day Pass","price":15,"duration":0},{"name":"Hot Desk Monthly","price":120,"duration":0},{"name":"Meeting Room 1h","price":25,"duration":60}]', '["Coworking","Meeting Rooms","Events"]', 70, 'trusted', '["verified","active_community"]', 4.5, 65, 10, 'active', datetime('now', '-90 days'), datetime('now')),

('biz_seed_05', 'user_seed_05', 'Saigon Ink Tattoo', 'Beauty', 'Custom tattoo designs. Japanese, traditional, minimalist styles.', 10.7710, 106.6940, '56 Tran Hung Dao, District 5', 'Ho Chi Minh City', '+84 28 3333 4444', '{"Mon":{"open":"10:00","close":"20:00"},"Tue":{"open":"10:00","close":"20:00"},"Wed":{"open":"10:00","close":"20:00"},"Thu":{"open":"10:00","close":"20:00"},"Fri":{"open":"10:00","close":"21:00"},"Sat":{"open":"10:00","close":"21:00"},"Sun":{"closed":true}}', 1, '', '[]', '[{"name":"Consultation","price":0,"duration":30},{"name":"Small Tattoo","price":50,"duration":60},{"name":"Large Piece","price":200,"duration":180}]', '["Tattoo","Art","Custom Design"]', 55, 'verified', '[]', 4.7, 42, 8, 'active', datetime('now', '-15 days'), datetime('now'));

-- ── Circles ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO circles (id, name, slug, category, description, city, owner_id, visibility, location_lat, location_lng, verification_level, trust_score, trust_level, badges, member_count, event_count, status, created_at, updated_at) VALUES
('circle_seed_01', 'Startup Builders Saigon', 'startup-builders-saigon', 'Tech', 'Community for tech founders and builders in HCMC. Weekly meetups, pitch nights, co-building sessions.', 'Ho Chi Minh City', 'user_seed_01', 'public', 10.7769, 106.7009, 1, 82, 'trusted', '["active_community","verified"]', 245, 8, 'active', datetime('now', '-120 days'), datetime('now')),
('circle_seed_02', 'Crypto Vietnam', 'crypto-vietnam', 'Crypto', 'Vietnam crypto community. DeFi, NFTs, trading, building. No scams, verified members only.', 'Vietnam', 'user_seed_02', 'public', 21.0285, 105.8542, 1, 75, 'trusted', '["verified"]', 180, 5, 'active', datetime('now', '-90 days'), datetime('now')),
('circle_seed_03', 'Saigon Foodies', 'saigon-foodies', 'Food', 'Discover the best food spots in Saigon. Reviews, hidden gems, food tours.', 'Ho Chi Minh City', 'user_seed_04', 'public', 10.7750, 106.7020, 1, 72, 'trusted', '["active_community"]', 320, 12, 'active', datetime('now', '-150 days'), datetime('now')),
('circle_seed_04', 'Health & Wellness HCM', 'health-wellness-hcm', 'Lifestyle', 'Yoga, meditation, fitness, nutrition. Healthy living in Ho Chi Minh City.', 'Ho Chi Minh City', 'user_seed_05', 'public', 10.7800, 106.6950, 0, 60, 'verified', '[]', 95, 4, 'active', datetime('now', '-60 days'), datetime('now')),
('circle_seed_05', 'Digital Nomads VN', 'digital-nomads-vn', 'Travel', 'Coworking spots, visa tips, meetups for digital nomads in Vietnam.', 'Vietnam', 'user_seed_01', 'public', 10.7769, 106.7009, 1, 70, 'trusted', '["active_community"]', 410, 6, 'active', datetime('now', '-200 days'), datetime('now')),
('circle_seed_06', 'Beauty & Style Saigon', 'beauty-style-saigon', 'Beauty', 'Beauty tips, salon reviews, skincare routines. Saigon beauty community.', 'Ho Chi Minh City', 'user_seed_03', 'public', 10.7780, 106.6960, 0, 48, 'verified', '[]', 65, 2, 'active', datetime('now', '-30 days'), datetime('now'));

-- ── Circle Members (some users join circles) ────────────────────────────
INSERT OR IGNORE INTO circle_members (id, circle_id, user_id, role, status, joined_at) VALUES
('cm_01', 'circle_seed_01', 'user_seed_01', 'owner', 'active', datetime('now', '-120 days')),
('cm_02', 'circle_seed_01', 'user_seed_02', 'member', 'active', datetime('now', '-100 days')),
('cm_03', 'circle_seed_01', 'user_seed_03', 'member', 'active', datetime('now', '-80 days')),
('cm_04', 'circle_seed_02', 'user_seed_02', 'owner', 'active', datetime('now', '-90 days')),
('cm_05', 'circle_seed_02', 'user_seed_01', 'member', 'active', datetime('now', '-70 days')),
('cm_06', 'circle_seed_03', 'user_seed_04', 'owner', 'active', datetime('now', '-150 days')),
('cm_07', 'circle_seed_03', 'user_seed_05', 'member', 'active', datetime('now', '-130 days')),
('cm_08', 'circle_seed_03', 'user_seed_01', 'member', 'active', datetime('now', '-2 hours')),
('cm_09', 'circle_seed_04', 'user_seed_05', 'owner', 'active', datetime('now', '-60 days')),
('cm_10', 'circle_seed_04', 'user_seed_03', 'member', 'active', datetime('now', '-40 days')),
('cm_11', 'circle_seed_05', 'user_seed_01', 'owner', 'active', datetime('now', '-200 days')),
('cm_12', 'circle_seed_05', 'user_seed_04', 'member', 'active', datetime('now', '-180 days')),
('cm_13', 'circle_seed_06', 'user_seed_03', 'owner', 'active', datetime('now', '-30 days')),
('cm_14', 'circle_seed_06', 'user_seed_05', 'member', 'active', datetime('now', '-20 days')),
-- Current user joins some circles
('cm_20', 'circle_seed_01', 'user_0c414acb4b21c5cc', 'member', 'active', datetime('now', '-10 days')),
('cm_21', 'circle_seed_03', 'user_0c414acb4b21c5cc', 'member', 'active', datetime('now', '-5 days')),
('cm_22', 'circle_seed_05', 'user_0c414acb4b21c5cc', 'member', 'active', datetime('now', '-3 days'));

-- ── Events ──────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO events (id, title, description, circle_id, host_user_id, start_time, end_time, location_name, location_lat, location_lng, city, capacity, joined_count, visibility, status, verified, created_at, updated_at) VALUES
('evt_seed_01', 'Saigon Startup Pitch Night', 'Monthly pitch night — 5 startups, 3 minutes each. Networking after. Pizza + drinks provided.', 'circle_seed_01', 'user_seed_01', datetime('now', '+2 hours'), datetime('now', '+5 hours'), 'Tech Hub Coworking', 10.7820, 106.6980, 'Ho Chi Minh City', 50, 18, 'public', 'scheduled', 1, datetime('now', '-3 days'), datetime('now')),

('evt_seed_02', 'Crypto Trading Workshop', 'Learn DeFi basics: yield farming, liquidity pools, risk management. Bring your laptop.', 'circle_seed_02', 'user_seed_02', datetime('now', '+1 day'), datetime('now', '+1 day', '+3 hours'), 'Tech Hub Coworking', 10.7820, 106.6980, 'Ho Chi Minh City', 30, 12, 'public', 'scheduled', 1, datetime('now', '-5 days'), datetime('now')),

('evt_seed_03', 'Saigon Street Food Tour', 'Guided walking tour through District 1 hidden gems. 8 stops, unlimited tastings.', 'circle_seed_03', 'user_seed_04', datetime('now', '-30 minutes'), datetime('now', '+3 hours'), 'Ben Thanh Market', 10.7725, 106.6980, 'Ho Chi Minh City', 15, 15, 'public', 'live', 1, datetime('now', '-7 days'), datetime('now')),

('evt_seed_04', 'Morning Yoga in the Park', 'Free outdoor yoga session. All levels. Bring your own mat.', 'circle_seed_04', 'user_seed_05', datetime('now', '+1 day', '+6 hours'), datetime('now', '+1 day', '+7 hours'), 'Tao Dan Park', 10.7740, 106.6910, 'Ho Chi Minh City', 25, 8, 'public', 'scheduled', 0, datetime('now', '-2 days'), datetime('now')),

('evt_seed_05', 'Digital Nomad Meetup', 'Monthly casual meetup for remote workers. Share tips, find co-living partners.', 'circle_seed_05', 'user_seed_01', datetime('now', '+3 days'), datetime('now', '+3 days', '+3 hours'), 'The Coffee House', 10.7769, 106.7009, 'Ho Chi Minh City', 40, 22, 'public', 'scheduled', 1, datetime('now', '-1 day'), datetime('now')),

('evt_seed_06', 'Beauty Workshop: K-Beauty Routine', 'Korean skincare routine demo + free samples. Limited spots!', 'circle_seed_06', 'user_seed_03', datetime('now', '+5 days'), datetime('now', '+5 days', '+2 hours'), 'Zen Yoga Studio', 10.7800, 106.6950, 'Ho Chi Minh City', 20, 6, 'public', 'scheduled', 0, datetime('now', '-1 day'), datetime('now'));

-- ── Signals ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO signals (id, author_id, type, title, description, category, location_lat, location_lng, radius, visibility, target_circle_id, trust_score_snapshot, verified, expires_at, views_count, responses_count, saves_count, status, created_at, updated_at) VALUES
('sig_seed_01', 'user_seed_01', 'presence', 'Working at Tech Hub', 'Open for coffee chats. Building a new AI tool — happy to demo!', 'Tech', 10.7820, 106.6980, 5000, 'public', 'circle_seed_01', 78, 1, datetime('now', '+4 hours'), 45, 5, 3, 'active', datetime('now', '-30 minutes'), datetime('now')),

('sig_seed_02', 'user_seed_04', 'intent', 'Looking for bun cha buddy', 'Anyone want to try that new bun cha spot on Ly Tu Trong? Going in 30 min.', 'Food', 10.7750, 106.7020, 3000, 'public', 'circle_seed_03', 50, 0, datetime('now', '+2 hours'), 23, 8, 1, 'active', datetime('now', '-15 minutes'), datetime('now')),

('sig_seed_03', 'user_seed_02', 'offer', '20% off BTC trading course', 'Launching my crypto course next week. Early bird discount for circle members.', 'Crypto', 21.0285, 105.8542, 0, 'public', 'circle_seed_02', 65, 1, datetime('now', '+7 days'), 120, 15, 22, 'active', datetime('now', '-2 hours'), datetime('now')),

('sig_seed_04', 'user_seed_05', 'presence', 'Teaching yoga at Tao Dan', 'Free session in 1 hour. Bring water and a mat!', 'Wellness', 10.7740, 106.6910, 2000, 'public', 'circle_seed_04', 72, 1, datetime('now', '+3 hours'), 18, 3, 5, 'active', datetime('now', '-45 minutes'), datetime('now')),

('sig_seed_05', 'user_seed_03', 'intent', 'Need a React developer', 'Looking for a senior React dev for a 2-week freelance project. DM me.', 'Tech', 10.7800, 106.6950, 10000, 'public', 'circle_seed_01', 85, 1, datetime('now', '+3 days'), 67, 12, 8, 'active', datetime('now', '-1 hour'), datetime('now')),

('sig_seed_06', 'user_0c414acb4b21c5cc', 'presence', 'I am here', 'Checking out the neighborhood', 'General', 10.7769, 106.7009, 1000, 'public', NULL, 50, 0, datetime('now', '+6 hours'), 5, 0, 0, 'active', datetime('now', '-10 minutes'), datetime('now'));

-- ── Profiles ────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO profiles (id, user_id, headline, bio, industry, skills, experience, education, languages, lat, lng, city, available, work_type, trust_score_snapshot, status, created_at, updated_at) VALUES
('prof_01', 'user_seed_01', 'Full-Stack Developer | AI Enthusiast', 'Building cool things with code. 5 years experience in React, Node, Python.', 'Technology', '["React","Node.js","Python","AI/ML","TypeScript"]', '[]', '[]', '["Vietnamese","English"]', 10.7769, 106.7009, 'Ho Chi Minh City', 1, 'hybrid', 78, 'active', datetime('now', '-30 days'), datetime('now')),
('prof_02', 'user_seed_02', 'Crypto Trader & Educator', 'Trading since 2017. Teaching others how to navigate DeFi safely.', 'Finance', '["DeFi","Trading","Smart Contracts","Solidity"]', '[]', '[]', '["Vietnamese","English"]', 21.0285, 105.8542, 'Hanoi', 1, 'remote', 65, 'active', datetime('now', '-45 days'), datetime('now')),
('prof_03', 'user_seed_03', 'UX/UI Designer @ Toii Labs', 'Designing delightful user experiences. Figma, prototyping, user research.', 'Design', '["Figma","UX Research","Prototyping","Design Systems"]', '[]', '[]', '["Vietnamese","English","Korean"]', 10.7800, 106.6950, 'Ho Chi Minh City', 1, 'onsite', 85, 'active', datetime('now', '-60 days'), datetime('now')),
('prof_04', 'user_seed_04', 'Food Photographer & Blogger', 'Capturing Saigon one dish at a time. Available for food shoots.', 'Media', '["Photography","Content Creation","Social Media","Food Styling"]', '[]', '[]', '["Vietnamese","English"]', 10.7750, 106.7020, 'Ho Chi Minh City', 1, 'freelance', 50, 'active', datetime('now', '-20 days'), datetime('now')),
('prof_05', 'user_seed_05', 'Certified Yoga Instructor', '500hr RYT certified. Specializing in vinyasa and meditation. Private & group sessions.', 'Wellness', '["Yoga","Meditation","Breathwork","Wellness Coaching"]', '[]', '[]', '["Vietnamese","English"]', 10.7730, 106.7050, 'Ho Chi Minh City', 1, 'hybrid', 72, 'active', datetime('now', '-90 days'), datetime('now'));

-- ── Reviews (for businesses) ────────────────────────────────────────────
INSERT OR IGNORE INTO reviews (id, business_id, author_id, rating, body, status, created_at, updated_at) VALUES
('rev_01', 'biz_seed_01', 'user_seed_03', 5, 'Best coffee in District 1! The phin sua da is amazing. Great wifi too.', 'active', datetime('now', '-5 days'), datetime('now', '-5 days')),
('rev_02', 'biz_seed_01', 'user_seed_04', 4, 'Nice atmosphere, a bit crowded on weekends. Coffee is solid.', 'active', datetime('now', '-10 days'), datetime('now', '-10 days')),
('rev_03', 'biz_seed_02', 'user_seed_01', 5, 'Incredible yoga class. Sarah is an amazing instructor. Highly recommend the morning flow.', 'active', datetime('now', '-3 days'), datetime('now', '-3 days')),
('rev_04', 'biz_seed_03', 'user_seed_05', 5, 'The special banh mi with truffle mayo is insane. Must try!', 'active', datetime('now', '-7 days'), datetime('now', '-7 days')),
('rev_05', 'biz_seed_04', 'user_seed_03', 4, 'Great coworking space. Fast internet, good coffee machine. Meeting rooms could be bigger.', 'active', datetime('now', '-2 days'), datetime('now', '-2 days'));

-- ── Notifications (for current user) ────────────────────────────────────
INSERT OR IGNORE INTO notifications (id, user_id, type, title, body, ref_type, ref_id, read, created_at) VALUES
('notif_01', 'user_0c414acb4b21c5cc', 'circle_event', 'New Event', 'Saigon Startup Pitch Night starts in 2 hours!', 'event', 'evt_seed_01', 0, datetime('now', '-1 hour')),
('notif_02', 'user_0c414acb4b21c5cc', 'signal_response', 'Signal Response', 'Anna Nguyen responded to your signal', 'signal', 'sig_seed_06', 0, datetime('now', '-30 minutes')),
('notif_03', 'user_0c414acb4b21c5cc', 'circle_activity', 'New in Saigon Foodies', '3 new members joined Saigon Foodies today', 'circle', 'circle_seed_03', 0, datetime('now', '-2 hours'));
