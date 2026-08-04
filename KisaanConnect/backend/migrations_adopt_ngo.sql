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