-- ================================================================
--  BLISS BANGLADESH — Supabase Database Setup
--  Paste this entire file into:
--  Supabase Dashboard → SQL Editor → New Query → Run
-- ================================================================

-- 1. APPOINTMENTS TABLE
CREATE TABLE IF NOT EXISTS appointments (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_name     TEXT        NOT NULL,
  phone            TEXT        NOT NULL,
  dob              DATE,
  service          TEXT        NOT NULL,
  appointment_date DATE        NOT NULL,
  time_slot        TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CONTACT SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS contact_submissions (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT        NOT NULL,
  email      TEXT,
  phone      TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE appointments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES — Anyone (public) can INSERT (submit forms)
CREATE POLICY "Public can insert appointments"
  ON appointments FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can insert contact submissions"
  ON contact_submissions FOR INSERT WITH CHECK (true);

-- 5. POLICIES — Only authenticated admins can SELECT / UPDATE
CREATE POLICY "Admin can read appointments"
  ON appointments FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin can update appointments"
  ON appointments FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Admin can read contact submissions"
  ON contact_submissions FOR SELECT USING (auth.role() = 'authenticated');

-- ================================================================
--  AFTER RUNNING THIS SQL:
--  Go to Authentication → Users → Add User
--  Create your admin account with an email + password.
--  That email/password is what you use to log into admin.html
-- ================================================================
