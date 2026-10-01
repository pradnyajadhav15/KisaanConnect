-- KisaanConnect database setup for a fresh PostgreSQL database (e.g. Neon).
-- Run it once in your database's SQL editor (or psql). Safe to run twice.

-- 1. Core tables (schema.sql)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('farmer','consumer')),
    name TEXT,
    email TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crops (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity >= 0),
    unit TEXT NOT NULL,
    price_per_unit REAL NOT NULL CHECK(price_per_unit > 0),
    description TEXT,
    location TEXT,
    available BOOLEAN DEFAULT TRUE,
    farmer_id INTEGER NOT NULL REFERENCES users(id),
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_crops_farmer ON crops(farmer_id);
CREATE INDEX IF NOT EXISTS idx_crops_available ON crops(available);

CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    crop_id INTEGER NOT NULL REFERENCES crops(id),
    quantity REAL NOT NULL,
    cart_id TEXT NOT NULL,
    unit_price REAL,
    crop_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cart ON cart_items(cart_id);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    consumer_id INTEGER NOT NULL REFERENCES users(id),
    farmer_id INTEGER NOT NULL REFERENCES users(id),
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    shipping_address TEXT NOT NULL,
    phone TEXT,
    consumer_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_consumer ON orders(consumer_id);
CREATE INDEX IF NOT EXISTS idx_orders_farmer ON orders(farmer_id);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    crop_id INTEGER NOT NULL REFERENCES crops(id),
    farmer_id INTEGER NOT NULL REFERENCES users(id),
    quantity REAL NOT NULL,
    unit_price REAL,
    crop_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_orderitems_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS wishlist_items (
    id SERIAL PRIMARY KEY,
    consumer_id INTEGER NOT NULL REFERENCES users(id),
    crop_id INTEGER NOT NULL REFERENCES crops(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(consumer_id, crop_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_consumer ON wishlist_items(consumer_id);

-- 2. Adopt-a-Farm and NGO tables (migrations_adopt_ngo.sql)
-- Farm plots a farmer offers for adoption
CREATE TABLE IF NOT EXISTS farm_plots (
    id                SERIAL PRIMARY KEY,
    farmer_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title             VARCHAR(200) NOT NULL,
    description       TEXT,
    crop_type         VARCHAR(100) NOT NULL,
    location          VARCHAR(200) NOT NULL,
    area_guntha       NUMERIC(8,2) NOT NULL,
    price_per_season  NUMERIC(10,2) NOT NULL,
    expected_yield_kg NUMERIC(10,2),
    season_start      DATE,
    season_end        DATE,
    slots_total       INTEGER NOT NULL DEFAULT 1,
    slots_taken       INTEGER NOT NULL DEFAULT 0,
    image_url         TEXT,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farm_plots_farmer ON farm_plots(farmer_id);
CREATE INDEX IF NOT EXISTS idx_farm_plots_active ON farm_plots(is_active);

-- A consumer adopting a plot
CREATE TABLE IF NOT EXISTS adoptions (
    id                  SERIAL PRIMARY KEY,
    plot_id             INTEGER NOT NULL REFERENCES farm_plots(id) ON DELETE CASCADE,
    consumer_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount              NUMERIC(10,2) NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'pending',
    payment_status      VARCHAR(30) NOT NULL DEFAULT 'pending',
    razorpay_order_id   VARCHAR(120),
    razorpay_payment_id VARCHAR(120),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adoptions_consumer ON adoptions(consumer_id);
CREATE INDEX IF NOT EXISTS idx_adoptions_plot ON adoptions(plot_id);

-- Farmer posts progress updates visible to adopters
CREATE TABLE IF NOT EXISTS plot_updates (
    id          SERIAL PRIMARY KEY,
    plot_id     INTEGER NOT NULL REFERENCES farm_plots(id) ON DELETE CASCADE,
    farmer_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    body        TEXT,
    image_url   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plot_updates_plot ON plot_updates(plot_id);

-- Partner NGOs
CREATE TABLE IF NOT EXISTS ngos (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(200) NOT NULL,
    description   TEXT,
    focus_area    VARCHAR(150),
    location      VARCHAR(200),
    website       VARCHAR(300),
    logo_url      TEXT,
    reg_number    VARCHAR(120),
    is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    total_raised  NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Donations to NGOs
CREATE TABLE IF NOT EXISTS donations (
    id                  SERIAL PRIMARY KEY,
    ngo_id              INTEGER NOT NULL REFERENCES ngos(id) ON DELETE CASCADE,
    donor_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
    donor_name          VARCHAR(200),
    donor_email         VARCHAR(200),
    amount              NUMERIC(10,2) NOT NULL,
    is_anonymous        BOOLEAN NOT NULL DEFAULT FALSE,
    message             TEXT,
    payment_status      VARCHAR(30) NOT NULL DEFAULT 'pending',
    razorpay_order_id   VARCHAR(120),
    razorpay_payment_id VARCHAR(120),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donations_ngo ON donations(ngo_id);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_id);

-- 3. Partner NGOs (seed_ngos.py)
INSERT INTO ngos (name, description, focus_area, location, website, is_verified)
SELECT 'Annapurna Farmer Trust', 'Provides interest-free seed and input loans to smallholder farmers in drought-prone Marathwada, so families are not pushed toward informal moneylenders before sowing season.', 'Farmer debt relief', 'Latur, Maharashtra', 'https://example.org/annapurna', TRUE
WHERE NOT EXISTS (SELECT 1 FROM ngos WHERE name = 'Annapurna Farmer Trust');
INSERT INTO ngos (name, description, focus_area, location, website, is_verified)
SELECT 'Beej Bachao Collective', 'Runs community seed banks preserving indigenous varieties of jowar, bajra and pulses, and trains farmers in saving and exchanging their own seed.', 'Seed sovereignty', 'Nashik, Maharashtra', 'https://example.org/beejbachao', TRUE
WHERE NOT EXISTS (SELECT 1 FROM ngos WHERE name = 'Beej Bachao Collective');
INSERT INTO ngos (name, description, focus_area, location, website, is_verified)
SELECT 'Sakhi Kisan Sangathan', 'Supports women farmers with land-rights paperwork, cooperative formation, and direct market access so they are recognised as cultivators in their own right.', 'Women farmers', 'Solapur, Maharashtra', 'https://example.org/sakhikisan', TRUE
WHERE NOT EXISTS (SELECT 1 FROM ngos WHERE name = 'Sakhi Kisan Sangathan');
INSERT INTO ngos (name, description, focus_area, location, website, is_verified)
SELECT 'Paani Foundation for Fields', 'Builds farm ponds, contour trenches and watershed structures with village labour, cutting irrigation costs for hundreds of marginal farms.', 'Water conservation', 'Ahmednagar, Maharashtra', 'https://example.org/paanifields', TRUE
WHERE NOT EXISTS (SELECT 1 FROM ngos WHERE name = 'Paani Foundation for Fields');
INSERT INTO ngos (name, description, focus_area, location, website, is_verified)
SELECT 'Kisan Shiksha Kendra', 'Pays school and college fees for children of farming families facing crop failure, so education is not the first thing sacrificed in a bad year.', 'Farmer family education', 'Kolhapur, Maharashtra', 'https://example.org/kisanshiksha', TRUE
WHERE NOT EXISTS (SELECT 1 FROM ngos WHERE name = 'Kisan Shiksha Kendra');

-- 4. Check: should list 11 tables and 5 NGOs
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
SELECT COUNT(*) AS ngos FROM ngos;
