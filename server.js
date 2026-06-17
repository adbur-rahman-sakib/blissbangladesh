require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const fs = require('fs');
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

// ==========================================
// IMAGE UPLOAD CONFIGURATION
// ==========================================

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_IMAGE_TYPES.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed image types: JPG, PNG, WEBP, GIF.'));
    }
  }
});

// Helper: Delete a previously uploaded image (ignores default/static asset paths)
function deleteUploadedImage(imagePath) {
  if (imagePath && imagePath.startsWith('/uploads/')) {
    fs.unlink(path.join(__dirname, 'public', imagePath), () => {});
  }
}

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

// Role-based access middleware — usage: requireRole('admin') or requireRole('admin', 'manager')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.adminId) {
      return res.status(401).json({ error: 'Unauthorized access. Please log in.' });
    }
    if (!roles.includes(req.session.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
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
    const sections = db.prepare('SELECT * FROM sections WHERE is_visible = 1 ORDER BY display_order ASC, id ASC').all();
    res.render('index', { settings, sections });
  } catch (err) {
    console.error('Error loading home page:', err);
    res.status(500).send('Internal Server Error');
  }
});

// GET: EPI Vaccine Schedule (used by the public immunization calculator)
app.get('/api/vaccines', (req, res) => {
  try {
    const vaccines = db.prepare('SELECT id, name, age_text, offset_days, diseases FROM vaccines ORDER BY display_order ASC, offset_days ASC').all();
    res.json(vaccines);
  } catch (err) {
    console.error('Error fetching vaccine schedule:', err);
    res.status(500).json({ error: 'Failed to load vaccine schedule.' });
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
      req.session.role = user.role || 'editor';
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
    const users = db.prepare('SELECT id, username, role, created_at FROM users').all();
    const sections = db.prepare('SELECT * FROM sections ORDER BY display_order ASC, id ASC').all();
    const vaccines = db.prepare('SELECT * FROM vaccines ORDER BY display_order ASC, offset_days ASC').all();

    res.render('admin/dashboard', {
      settings,
      bookings,
      contacts,
      users,
      sections,
      vaccines,
      currentUser: req.session.username,
      currentUserId: req.session.adminId,
      currentUserRole: req.session.role || 'editor'
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
app.delete('/api/admin/bookings/:id', requireRole('admin', 'manager'), (req, res) => {
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
app.delete('/api/admin/contacts/:id', requireRole('admin', 'manager'), (req, res) => {
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

// POST: Create Admin User (admin only)
app.post('/api/admin/users', requireRole('admin'), (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const validRoles = ['admin', 'manager', 'editor'];
    const assignedRole = validRoles.includes(role) ? role : 'editor';

    // Check if user already exists
    const checkStmt = db.prepare('SELECT id FROM users WHERE username = ?');
    const existing = checkStmt.get(username);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists.' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
    const result = stmt.run(username, hash, assignedRole);

    if (result.changes > 0) {
      res.json({ success: true, userId: result.lastInsertRowid, role: assignedRole });
    } else {
      res.status(500).json({ error: 'Failed to create user.' });
    }
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Database creation failed.' });
  }
});

// DELETE: Delete Admin User (admin only)
app.delete('/api/admin/users/:id', requireRole('admin'), (req, res) => {
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

// POST: Change Password — admin can change any user's; manager/editor can only change their own
app.post('/api/admin/users/change-password', isAuthenticated, (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'User ID and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const role = req.session.role || 'editor';
    if (role !== 'admin' && parseInt(userId) !== req.session.adminId) {
      return res.status(403).json({ error: 'You can only change your own password.' });
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

// ==========================================
// 5. SECTIONS, VACCINES & IMAGE UPLOADS
// ==========================================

// Whitelist of settings keys that may be updated via image upload
const ALLOWED_IMAGE_SETTING_FIELDS = [
  'hero_image',
  'service_vax_image',
  'service_fp_image',
  'service_anc_image',
  'service_autism_image'
];

// POST: Upload/replace an image for a whitelisted settings field (hero banner, service cards)
app.post('/api/admin/upload-setting-image', isAuthenticated, upload.single('image'), (req, res) => {
  try {
    const { field } = req.body;

    if (!ALLOWED_IMAGE_SETTING_FIELDS.includes(field)) {
      if (req.file) deleteUploadedImage(`/uploads/${req.file.filename}`);
      return res.status(400).json({ error: 'Invalid settings field for image upload.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }

    const newPath = `/uploads/${req.file.filename}`;

    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(field);
    const oldPath = row ? row.value : null;

    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(newPath, field);

    deleteUploadedImage(oldPath);

    res.json({ success: true, path: newPath });
  } catch (err) {
    console.error('Error uploading settings image:', err);
    res.status(500).json({ error: 'Image upload failed.' });
  }
});

// ----- Custom Homepage Sections CRUD -----

// POST: Create a new custom section
app.post('/api/admin/sections', isAuthenticated, upload.single('image'), (req, res) => {
  try {
    const { title, content, is_visible } = req.body;

    if (!title || !content) {
      if (req.file) deleteUploadedImage(`/uploads/${req.file.filename}`);
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    const visible = is_visible === '0' ? 0 : 1;

    const maxOrderRow = db.prepare('SELECT MAX(display_order) as maxOrder FROM sections').get();
    const nextOrder = (maxOrderRow.maxOrder || 0) + 1;

    const stmt = db.prepare(`
      INSERT INTO sections (title, content, image_path, display_order, is_visible)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(title, content, imagePath, nextOrder, visible);

    res.json({ success: true, sectionId: result.lastInsertRowid });
  } catch (err) {
    console.error('Error creating section:', err);
    res.status(500).json({ error: 'Failed to create section.' });
  }
});

// POST: Update an existing custom section
app.post('/api/admin/sections/:id', isAuthenticated, upload.single('image'), (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, is_visible } = req.body;

    if (!title || !content) {
      if (req.file) deleteUploadedImage(`/uploads/${req.file.filename}`);
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    const existing = db.prepare('SELECT image_path FROM sections WHERE id = ?').get(id);
    if (!existing) {
      if (req.file) deleteUploadedImage(`/uploads/${req.file.filename}`);
      return res.status(404).json({ error: 'Section not found.' });
    }

    const visible = is_visible === '0' ? 0 : 1;
    let imagePath = existing.image_path;

    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
      deleteUploadedImage(existing.image_path);
    }

    const stmt = db.prepare(`
      UPDATE sections SET title = ?, content = ?, image_path = ?, is_visible = ? WHERE id = ?
    `);
    stmt.run(title, content, imagePath, visible, id);

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating section:', err);
    res.status(500).json({ error: 'Failed to update section.' });
  }
});

// DELETE: Remove a custom section
app.delete('/api/admin/sections/:id', requireRole('admin', 'manager'), (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT image_path FROM sections WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Section not found.' });
    }

    db.prepare('DELETE FROM sections WHERE id = ?').run(id);
    deleteUploadedImage(existing.image_path);

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting section:', err);
    res.status(500).json({ error: 'Failed to delete section.' });
  }
});

// POST: Reorder a custom section (move up or down)
app.post('/api/admin/sections/:id/move', isAuthenticated, (req, res) => {
  try {
    const { id } = req.params;
    const { direction } = req.body;

    if (direction !== 'up' && direction !== 'down') {
      return res.status(400).json({ error: 'Direction must be "up" or "down".' });
    }

    const current = db.prepare('SELECT * FROM sections WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ error: 'Section not found.' });
    }

    const neighbor = direction === 'up'
      ? db.prepare('SELECT * FROM sections WHERE display_order < ? ORDER BY display_order DESC LIMIT 1').get(current.display_order)
      : db.prepare('SELECT * FROM sections WHERE display_order > ? ORDER BY display_order ASC LIMIT 1').get(current.display_order);

    if (!neighbor) {
      return res.json({ success: true });
    }

    const updateOrder = db.prepare('UPDATE sections SET display_order = ? WHERE id = ?');
    updateOrder.run(neighbor.display_order, current.id);
    updateOrder.run(current.display_order, neighbor.id);

    res.json({ success: true });
  } catch (err) {
    console.error('Error reordering section:', err);
    res.status(500).json({ error: 'Failed to reorder section.' });
  }
});

// ----- Vaccine Schedule CRUD -----

// POST: Create a new vaccine schedule entry
app.post('/api/admin/vaccines', isAuthenticated, (req, res) => {
  try {
    const { name, age_text, offset_days, diseases } = req.body;

    if (!name || !age_text || offset_days === undefined || offset_days === null || offset_days === '') {
      return res.status(400).json({ error: 'Name, age text, and offset days are required.' });
    }

    const maxOrderRow = db.prepare('SELECT MAX(display_order) as maxOrder FROM vaccines').get();
    const nextOrder = (maxOrderRow.maxOrder || 0) + 1;

    const stmt = db.prepare(`
      INSERT INTO vaccines (name, age_text, offset_days, diseases, display_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, age_text, parseInt(offset_days, 10), diseases || '', nextOrder);

    res.json({ success: true, vaccineId: result.lastInsertRowid });
  } catch (err) {
    console.error('Error creating vaccine entry:', err);
    res.status(500).json({ error: 'Failed to create vaccine entry.' });
  }
});

// POST: Update a vaccine schedule entry
app.post('/api/admin/vaccines/:id', isAuthenticated, (req, res) => {
  try {
    const { id } = req.params;
    const { name, age_text, offset_days, diseases } = req.body;

    if (!name || !age_text || offset_days === undefined || offset_days === null || offset_days === '') {
      return res.status(400).json({ error: 'Name, age text, and offset days are required.' });
    }

    const stmt = db.prepare(`
      UPDATE vaccines SET name = ?, age_text = ?, offset_days = ?, diseases = ? WHERE id = ?
    `);
    const result = stmt.run(name, age_text, parseInt(offset_days, 10), diseases || '', id);

    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Vaccine entry not found.' });
    }
  } catch (err) {
    console.error('Error updating vaccine entry:', err);
    res.status(500).json({ error: 'Failed to update vaccine entry.' });
  }
});

// DELETE: Remove a vaccine schedule entry
app.delete('/api/admin/vaccines/:id', requireRole('admin', 'manager'), (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM vaccines WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Vaccine entry not found.' });
    }
  } catch (err) {
    console.error('Error deleting vaccine entry:', err);
    res.status(500).json({ error: 'Failed to delete vaccine entry.' });
  }
});

// ==========================================
// ERROR HANDLING MIDDLEWARE (multer & general)
// ==========================================
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Image file is too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    console.error('Unhandled error:', err);
    return res.status(500).json({ error: err.message || 'An unexpected error occurred.' });
  }
  next();
});

// Start the server
app.listen(PORT, () => {
  console.log(`Bliss Bangladesh server is running on http://localhost:${PORT}`);
});
