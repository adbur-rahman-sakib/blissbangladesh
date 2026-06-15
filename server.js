require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Trust reverse proxy (needed for secure cookies when deployed behind one)
app.set('trust proxy', 1);

// Security headers (hides X-Powered-By, sets CSP, clickjacking protection, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    }
  }
}));

// Setup session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'bliss_bangladesh_default_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction // requires HTTPS in production
  }
}));

// Setup views and engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiter: max 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Authentication check middleware
function isAuthenticated(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    return res.status(401).json({ error: 'Unauthorized access. Please log in.' });
  }
  res.redirect('/admin/login');
}

// Helper: Get all settings from database
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(row => {
    settings[row.key] = row.value;
  });
  return settings;
}

// ==========================================
// 1. PUBLIC ROUTES
// ==========================================

// GET: Home Page
app.get('/', (req, res) => {
  try {
    const settings = getSettings();
    res.render('index', { settings });
  } catch (err) {
    console.error('Error loading home page:', err);
    res.status(500).send('Internal Server Error');
  }
});

// POST: Submit Booking Appointment
app.post('/api/bookings', (req, res) => {
  try {
    const { patientName, phone, dob, service, appointmentDate, timeSlot } = req.body;
    
    if (!patientName || !phone || !service || !appointmentDate || !timeSlot) {
      return res.status(400).json({ error: 'Missing required booking fields.' });
    }

    const insertBooking = db.prepare(`
      INSERT INTO bookings (patient_name, phone, dob, service, appointment_date, time_slot)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = insertBooking.run(patientName, phone, dob || '', service, appointmentDate, timeSlot);
    
    if (result.changes > 0) {
      res.json({ success: true, bookingId: result.lastInsertRowid });
    } else {
      res.status(500).json({ error: 'Failed to record booking.' });
    }
  } catch (err) {
    console.error('Error inserting booking:', err);
    res.status(500).json({ error: 'Database error occurred.' });
  }
});

// POST: Submit Contact Inquiry
app.post('/api/contacts', (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    
    if (!name || !phone || !message) {
      return res.status(400).json({ error: 'Missing required contact fields.' });
    }

    const insertContact = db.prepare(`
      INSERT INTO contacts (name, email, phone, message)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = insertContact.run(name, email || '', phone, message);
    
    if (result.changes > 0) {
      res.json({ success: true, contactId: result.lastInsertRowid });
    } else {
      res.status(500).json({ error: 'Failed to record contact inquiry.' });
    }
  } catch (err) {
    console.error('Error inserting contact:', err);
    res.status(500).json({ error: 'Database error occurred.' });
  }
});

// ==========================================
// 2. ADMIN AUTH ROUTES
// ==========================================

// GET: Login Page
app.get('/admin/login', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { error: null });
});

// POST: Login Handle
app.post('/admin/login', loginLimiter, (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username);

    if (user && bcrypt.compareSync(password, user.password_hash)) {
      req.session.adminId = user.id;
      req.session.username = user.username;
      return res.json({ success: true });
    }

    res.status(401).json({ error: 'Invalid username or password.' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during authentication.' });
  }
});

// GET: Logout Handle
app.get('/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/admin/login');
  });
});

// ==========================================
// 3. SECURE ADMIN ROUTE (DASHBOARD)
// ==========================================

// GET: Admin Dashboard
app.get('/admin/dashboard', isAuthenticated, (req, res) => {
  try {
    const settings = getSettings();
    
    const bookings = db.prepare('SELECT * FROM bookings ORDER BY created_at DESC').all();
    const contacts = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
    const users = db.prepare('SELECT id, username, created_at FROM users').all();
    
    res.render('admin/dashboard', {
      settings,
      bookings,
      contacts,
      users,
      currentUser: req.session.username,
      currentUserId: req.session.adminId
    });
  } catch (err) {
    console.error('Error loading admin dashboard:', err);
    res.status(500).send('Error loading dashboard data.');
  }
});

// ==========================================
// 4. SECURE ADMIN API ENDPOINTS
// ==========================================

// POST: Update Booking Status
app.post('/api/admin/bookings/status', isAuthenticated, (req, res) => {
  try {
    const { id, status } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'Booking ID and status are required.' });
    }

    const stmt = db.prepare('UPDATE bookings SET status = ? WHERE id = ?');
    const result = stmt.run(status, id);

    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Booking not found.' });
    }
  } catch (err) {
    console.error('Error updating booking status:', err);
    res.status(500).json({ error: 'Database update failed.' });
  }
});

// DELETE: Delete Booking
app.delete('/api/admin/bookings/:id', isAuthenticated, (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM bookings WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Booking not found.' });
    }
  } catch (err) {
    console.error('Error deleting booking:', err);
    res.status(500).json({ error: 'Database deletion failed.' });
  }
});

// POST: Update Contact Inquiry Status
app.post('/api/admin/contacts/status', isAuthenticated, (req, res) => {
  try {
    const { id, status } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'Inquiry ID and status are required.' });
    }

    const stmt = db.prepare('UPDATE contacts SET status = ? WHERE id = ?');
    const result = stmt.run(status, id);

    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Inquiry not found.' });
    }
  } catch (err) {
    console.error('Error updating contact status:', err);
    res.status(500).json({ error: 'Database update failed.' });
  }
});

// DELETE: Delete Contact Inquiry
app.delete('/api/admin/contacts/:id', isAuthenticated, (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM contacts WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Inquiry not found.' });
    }
  } catch (err) {
    console.error('Error deleting contact inquiry:', err);
    res.status(500).json({ error: 'Database deletion failed.' });
  }
});

// POST: Update Website Settings Data
app.post('/api/admin/settings', isAuthenticated, (req, res) => {
  try {
    const settingsData = req.body;
    
    // Prepare update query
    const stmt = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
    
    // Begin transaction style synchronous execution
    let count = 0;
    for (const [key, value] of Object.entries(settingsData)) {
      const result = stmt.run(value, key);
      if (result.changes > 0) count++;
    }
    
    res.json({ success: true, updatedCount: count });
  } catch (err) {
    console.error('Error updating website settings:', err);
    res.status(500).json({ error: 'Failed to save settings.' });
  }
});

// POST: Create Admin User
app.post('/api/admin/users', isAuthenticated, (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Check if user already exists
    const checkStmt = db.prepare('SELECT id FROM users WHERE username = ?');
    const existing = checkStmt.get(username);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists.' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    const result = stmt.run(username, hash);

    if (result.changes > 0) {
      res.json({ success: true, userId: result.lastInsertRowid });
    } else {
      res.status(500).json({ error: 'Failed to create user.' });
    }
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Database creation failed.' });
  }
});

// DELETE: Delete Admin User
app.delete('/api/admin/users/:id', isAuthenticated, (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting self
    if (parseInt(id) === req.session.adminId) {
      return res.status(400).json({ error: 'You cannot delete your own logged-in account.' });
    }

    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'User not found.' });
    }
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Database deletion failed.' });
  }
});

// POST: Change Password (any admin for themselves, or for others)
app.post('/api/admin/users/change-password', isAuthenticated, (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'User ID and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    const result = stmt.run(hash, userId);

    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'User not found.' });
    }
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ error: 'Password update failed.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Bliss Bangladesh server is running on http://localhost:${PORT}`);
});
