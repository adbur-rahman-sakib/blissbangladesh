require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new DatabaseSync(dbPath);

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    dob TEXT,
    service TEXT NOT NULL,
    appointment_date TEXT NOT NULL,
    time_slot TEXT NOT NULL,
    status TEXT DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// 1. Seed Default Admin User
const userCheck = db.prepare('SELECT COUNT(*) as count FROM users');
const { count: userCount } = userCheck.get();

if (userCount === 0) {
  const defaultUser = process.env.DEFAULT_ADMIN_USER || 'admin';
  const defaultPass = process.env.DEFAULT_ADMIN_PASS || 'admin123';
  const hash = bcrypt.hashSync(defaultPass, 10);
  
  const insertUser = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
  insertUser.run(defaultUser, hash);
  console.log(`Database seeded with default admin user: ${defaultUser}`);
}

// 2. Seed Default Settings
const settingsCheck = db.prepare('SELECT COUNT(*) as count FROM settings');
const { count: settingsCount } = settingsCheck.get();

if (settingsCount === 0) {
  const defaultSettings = {
    // Hero Section
    hero_title: 'Healthy Families,<br>Stronger Bangladesh',
    hero_description: 'Bliss Bangladesh is committed to providing trusted immunization and family planning services for a healthier tomorrow.',
    
    // Contact Info
    contact_phone: '09613 787878',
    contact_phone_alt: '02-55012345',
    contact_email: 'info@blissbangladesh.org',
    contact_email_alt: 'support@blissbangladesh.org',
    contact_address: 'House 7, Road 10, Sector 7, Uttara, Dhaka 1230',
    opening_hours_weekdays: 'Sat - Thu: 9:00 AM - 6:00 PM',
    opening_hours_weekend: 'Friday: Closed',
    
    // About Us Section
    about_subtitle: 'Dedicated to Community Wellness',
    about_paragraph_1: 'At Bliss Bangladesh, we operate as a leading authorized EPI (Expanded Program on Immunization) and Family Planning center. Our mission is simple: to make critical healthcare services accessible, comfortable, and reliable for families across Bangladesh.',
    about_paragraph_2: 'With modern medical equipment, highly trained healthcare professionals, and a warm, inviting environment, we ensure that both children and adults receive world-class preventative and diagnostic care.',
    stat_children: '10k+',
    stat_staff: '15+',
    stat_satisfaction: '99%',
    
    // Home Feature boxes
    feature_epi_desc: 'Official EPI vaccines managed under strict WHO guidelines.',
    feature_confidentiality_desc: 'Private consultations for family planning and antenatal care.',
    feature_affordability_desc: 'Free governmental vaccines and highly subsidized family consultations.',
    
    // Service descriptions (Brief overview on cards)
    service_vax_desc: 'Complete immunization services for infants, children, and adults.',
    service_fp_desc: 'Safe, effective, and confidential family planning solutions tailored to your needs.',
    service_anc_desc: 'Comprehensive care and support for a healthy pregnancy and safe delivery.',
    service_autism_desc: 'Specialized therapies and support for children with autism and their families.',
    
    // Service Modals Content - EPI Vaccination
    service_vax_title: 'EPI Vaccination Services',
    service_vax_details: 'The Expanded Programme on Immunization (EPI) is a vital global health initiative aimed at protecting infants, children, and pregnant women from vaccine-preventable diseases. At Bliss Bangladesh, we operate a fully authorized vaccination wing conforming to the World Health Organization (WHO) and government guidelines.',
    service_vax_hl_1: 'Free governmental routine child vaccines (BCG, Pentavalent, OPV, PCV, MR).',
    service_vax_hl_2: 'Adult immunization schedules (Hep B, Tetanus, Influenza).',
    service_vax_hl_3: 'Temperature-controlled cold-chain system for maximum vaccine efficacy.',
    service_vax_hl_4: 'Official immunization card tracking for school admission & travel.',
    
    // Service Modals Content - Family Planning
    service_fp_title: 'Confidential Family Planning',
    service_fp_details: 'Making informed reproductive choices is foundational to family health and empowerment. Bliss Bangladesh provides comprehensive, respectful, and fully confidential family planning counseling and services overseen by certified specialists.',
    service_fp_hl_1: 'Personal consultations with female doctors and counselors.',
    service_fp_hl_2: 'Temporary birth control options (oral contraceptives, barrier methods, 3-month injections).',
    service_fp_hl_3: 'Long-acting reversible contraceptives (IUDs, subdermal implants).',
    service_fp_hl_4: 'Post-partum family planning advice and educational guides.',
    
    // Service Modals Content - Antenatal Care
    service_anc_title: 'Comprehensive Antenatal Care',
    service_anc_details: 'Antenatal care (ANC) is the clinical care provided to pregnant individuals to ensure the best health conditions for both mother and baby. Our prenatal packages focus on monitoring, early detection of complications, and preparing parents for a safe delivery.',
    service_anc_hl_1: 'Regular checkups including blood pressure, weight, and fetal heart rate monitoring.',
    service_anc_hl_2: 'Diagnostic laboratory tests (blood profiling, blood sugar screening, urine analysis).',
    service_anc_hl_3: 'Ultrasonography scanning by experienced sonologists.',
    service_anc_hl_4: 'Prescriptions for vital micronutrients (iron, folic acid, calcium) and diet counseling.',
    
    // Service Modals Content - Autism Support
    service_autism_title: 'Autism Support & Therapy',
    service_autism_details: 'Neurodevelopmental growth is unique for every child. Bliss Bangladesh hosts an expert-led Autism and Developmental Support Unit designed to assist children with autism spectrum conditions (ASC) and other sensory-cognitive differences in achieving their full potential.',
    service_autism_hl_1: 'Early diagnostic screening and standardized developmental assessments.',
    service_autism_hl_2: 'One-on-one occupational therapy and sensory integration sessions.',
    service_autism_hl_3: 'Speech and language therapy to support communication milestones.',
    service_autism_hl_4: 'Family counseling and parent-led home training programs.'
  };

  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value);
  }
  console.log('Database seeded with default settings.');
}

module.exports = db;
