require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const bcrypt       = require('bcryptjs');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const multer       = require('multer');
const fs           = require('fs');
const path         = require('path');
const db           = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// ── Security headers ──────────────────────────────────────────────
app.use(helmet({
  // HSTS must be disabled in development — sending it over HTTP causes Chrome to permanently
  // force HTTPS for the origin, breaking the dev server (ERR_SSL_PROTOCOL_ERROR).
  hsts: isProd,
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      styleSrc:      ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc:       ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
      scriptSrc:     ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc:        ["'self'", "data:", "blob:"],
      // upgrade-insecure-requests only makes sense on HTTPS — omit in dev to avoid mixed-content loops
      upgradeInsecureRequests: isProd ? [] : null,
    }
  }
}));

// ── Sessions ──────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'bliss_admin_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax', secure: isProd }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/admin.js', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'public', 'admin.js'));
});

// Serve uploaded files (PDFs, images) without restrictive Helmet headers.
// Helmet's object-src 'none' and X-Download-Options: noopen block browser PDF viewers.
// Serve /uploads/* files with correct headers for inline PDF/image viewing.
// Uses req.params[0] (the wildcard portion) — avoids Windows path.normalize('/...')
// issues where a leading slash could be misinterpreted as drive-relative on Windows.
app.get('/uploads/*', (req, res) => {
  // req.params[0] = everything after /uploads/ with no leading slash, no query string
  const wildcard  = req.params[0] || '';
  // Reject any segment containing '..' — covers all traversal patterns
  if (wildcard.split('/').some(seg => seg === '..' || seg === '.')) {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  const uploadDir = path.join(__dirname, 'public', 'uploads');
  const filePath  = path.join(uploadDir, wildcard);
  // Absolute path guard — catches any edge case path.join didn't catch
  if (!filePath.startsWith(uploadDir + path.sep) && filePath !== uploadDir) {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  // Strip Helmet headers that block browser PDF viewer (object-src:none, X-Download-Options)
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Download-Options');
  res.removeHeader('Cross-Origin-Opener-Policy');
  res.removeHeader('Cross-Origin-Resource-Policy');
  // inline: browser renders PDF / images instead of forcing a download dialog
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.sendFile(filePath, function(err) {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'File not found.', path: '/' + wildcard });
    }
  });
});

app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);

// ── Upload directories ────────────────────────────────────────────
const dirs = ['uploads', 'uploads/events', 'uploads/resources'].map(d => path.join(__dirname, 'public', d));
dirs.forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ── Multer configs ────────────────────────────────────────────────
// Extension check only — MIME type varies by browser/OS for the same file
// (e.g. PDFs arrive as application/pdf OR application/octet-stream depending on browser).
// Filenames are fully replaced (timestamp+random) so no user input ever reaches disk.
function makeUpload(dest, maxMB, allowedExts) {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dest),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
      }
    }),
    limits: { fileSize: maxMB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedExts.includes(ext)) {
        return cb(Object.assign(new Error('Invalid file type. Allowed: ' + allowedExts.join(', ')), { status: 400 }));
      }
      cb(null, true);
    }
  });
}

const uploadImg   = makeUpload(dirs[0],  5, ['.jpg','.jpeg','.png','.webp','.gif']);
const uploadEvent = makeUpload(dirs[1], 50, ['.jpg','.jpeg','.png','.webp','.gif','.pdf']);
const uploadPdf   = makeUpload(dirs[2], 50, ['.pdf']);

// Resource uploads keep the original filename (sanitized).
// Prefix r{id}_ ensures two resources with same-named files don't overwrite each other.
const uploadResource = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, dirs[2]),
    filename: (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
      const base = path.basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-zA-Z0-9\-_.() ]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 80);
      const prefix = req.params && req.params.id ? 'r' + req.params.id + '_' : '';
      cb(null, prefix + base + ext);
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.pdf', '.doc', '.docx'].includes(ext)) {
      return cb(Object.assign(new Error('Only PDF, DOC and DOCX files are allowed.'), { status: 400 }));
    }
    cb(null, true);
  }
});

// ── Helpers ───────────────────────────────────────────────────────
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out  = {};
  rows.forEach(r => { out[r.key] = r.value; });
  return out;
}

function delFile(filePath) {
  if (filePath && filePath.startsWith('/uploads/')) {
    fs.unlink(path.join(__dirname, 'public', filePath), () => {});
  }
}

// Validate resource file paths on disk — clears stale DB entries
function validateResourceFiles() {
  try {
    const rows = db.prepare("SELECT id, file_path FROM resources WHERE file_path != ''").all();
    rows.forEach(r => {
      const fp = path.join(__dirname, 'public', r.file_path);
      if (!fs.existsSync(fp)) {
        db.prepare("UPDATE resources SET file_path='', original_filename='' WHERE id=?").run(r.id);
        console.warn('[resource] Cleared stale file for resource id', r.id);
      }
    });
  } catch(_) {}
}

function audit(req, action, table, targetId, details) {
  try {
    db.prepare('INSERT INTO audit_logs (user_id, username, action, target_table, target_id, details, ip) VALUES (?,?,?,?,?,?,?)')
      .run(req.session.adminId || null, req.session.username || 'system', action, table || null, targetId || null, details || null, req.ip);
  } catch (_) {}
}

// ── Rate limiters ─────────────────────────────────────────────────
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

// ── No-cache for admin pages ──────────────────────────────────────
function noCache(req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  next();
}

// ── Auth middleware ───────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session || !req.session.adminId) {
    if (req.xhr || (req.headers.accept || '').includes('json')) {
      return res.status(401).json({ error: 'Session expired. Please log in.' });
    }
    return res.redirect('/admin/login');
  }
  // Refresh role from DB on every request (handles role changes mid-session)
  try {
    const u = db.prepare('SELECT role FROM users WHERE id=?').get(req.session.adminId);
    if (!u) { req.session.destroy(); return res.redirect('/admin/login'); }
    req.session.role = u.role;
  } catch (_) {}
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.adminId) return res.status(401).json({ error: 'Unauthorized.' });
    try {
      const u = db.prepare('SELECT role FROM users WHERE id=?').get(req.session.adminId);
      if (!u) { req.session.destroy(() => {}); return res.status(401).json({ error: 'Session expired.' }); }
      req.session.role = u.role;
    } catch (_) {}
    if (!roles.includes(req.session.role)) return res.status(403).json({ error: 'Insufficient permissions.' });
    next();
  };
}

// ════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ════════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  try {
    const settings  = getSettings();
    const sections  = db.prepare('SELECT * FROM sections WHERE is_visible=1 ORDER BY display_order ASC, id ASC').all();
    const resources = db.prepare('SELECT * FROM resources WHERE is_visible=1 ORDER BY display_order ASC, id ASC').all();
    res.render('index', { settings, sections, resources });
  } catch (err) { console.error(err); res.status(500).send('Server Error'); }
});

app.get('/api/vaccines', (req, res) => {
  try {
    res.json(db.prepare('SELECT id,name,age_text,offset_days,diseases FROM vaccines ORDER BY offset_days ASC, display_order ASC').all());
  } catch (err) { res.status(500).json({ error: 'Failed to load vaccines.' }); }
});

app.get('/events', (req, res) => {
  try {
    res.render('events', { events: db.prepare('SELECT * FROM events WHERE is_published=1 ORDER BY event_date ASC').all() });
  } catch (err) { res.status(500).send('Server Error'); }
});

app.get('/events/:id', (req, res) => {
  try {
    const event = db.prepare('SELECT * FROM events WHERE id=? AND is_published=1').get(req.params.id);
    if (!event) return res.status(404).send('Event not found');
    res.render('event-detail', { event });
  } catch (err) { res.status(500).send('Server Error'); }
});

app.get('/api/events', (req, res) => {
  try {
    res.json(db.prepare('SELECT id,title,event_date,event_time,location,category,cover_image FROM events WHERE is_published=1 ORDER BY event_date ASC LIMIT 6').all());
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

app.post('/api/bookings', (req, res) => {
  try {
    const { patientName, phone, dob, service, appointmentDate, timeSlot } = req.body;
    if (!patientName || !phone || !service || !appointmentDate || !timeSlot)
      return res.status(400).json({ error: 'Missing required fields.' });
    const r = db.prepare('INSERT INTO bookings (patient_name,phone,dob,service,appointment_date,time_slot) VALUES (?,?,?,?,?,?)').run(patientName, phone, dob || '', service, appointmentDate, timeSlot);
    res.json({ success: true, bookingId: r.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: 'Database error.' }); }
});

app.post('/api/contacts', (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !phone || !message) return res.status(400).json({ error: 'Missing required fields.' });
    const r = db.prepare('INSERT INTO contacts (name,email,phone,message) VALUES (?,?,?,?)').run(name, email || '', phone, message);
    res.json({ success: true, contactId: r.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: 'Database error.' }); }
});

// ════════════════════════════════════════════════════════════════
// ADMIN AUTH
// ════════════════════════════════════════════════════════════════

app.get('/admin/login', noCache, (req, res) => {
  if (req.session?.adminId) return res.redirect('/admin/dashboard');
  res.render('admin/login', { error: null });
});

app.post('/admin/login', loginLimiter, (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
    const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: 'Invalid username or password.' });
    req.session.adminId  = user.id;
    req.session.username = user.username;
    req.session.role     = user.role || 'editor';
    audit(req, 'LOGIN', 'users', user.id, 'Successful login');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

app.get('/admin/logout', (req, res) => {
  audit(req, 'LOGOUT', null, null, null);
  req.session.destroy(() => {
    res.set('Cache-Control', 'no-store');
    res.redirect('/admin/login');
  });
});

// Session check for BFCache guard
app.get('/api/admin/session-check', (req, res) => {
  res.json({ ok: !!(req.session && req.session.adminId) });
});

// ════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ════════════════════════════════════════════════════════════════

app.get('/admin/dashboard', noCache, requireAuth, (req, res) => {
  try {
    validateResourceFiles();
    const settings = getSettings();
    const bookings  = db.prepare('SELECT * FROM bookings ORDER BY created_at DESC').all();
    const contacts  = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
    const users     = (req.session.role === 'editor')
      ? db.prepare('SELECT id,username,role,created_at FROM users WHERE id=?').all(req.session.adminId)
      : db.prepare('SELECT id,username,role,created_at FROM users ORDER BY created_at ASC').all();
    const sections  = db.prepare('SELECT * FROM sections ORDER BY display_order ASC, id ASC').all();
    const vaccines  = db.prepare('SELECT * FROM vaccines ORDER BY offset_days ASC, display_order ASC').all();
    const events    = db.prepare('SELECT * FROM events ORDER BY created_at DESC').all();
    const resources = db.prepare('SELECT * FROM resources ORDER BY display_order ASC, id ASC').all();
    const auditLogs = (req.session.role === 'editor')
      ? []
      : db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all();
    res.render('admin/dashboard', {
      settings, bookings, contacts, users, sections, vaccines, events, resources, auditLogs,
      currentUser:     req.session.username,
      currentUserId:   req.session.adminId,
      currentUserRole: req.session.role || 'editor'
    });
  } catch (err) { console.error(err); res.status(500).send('Dashboard error.'); }
});

// ════════════════════════════════════════════════════════════════
// ADMIN API — BOOKINGS
// ════════════════════════════════════════════════════════════════

app.post('/api/admin/bookings/status', requireAuth, (req, res) => {
  try {
    const { id, status } = req.body;
    if (!id || !status) return res.status(400).json({ error: 'ID and status required.' });
    const r = db.prepare('UPDATE bookings SET status=? WHERE id=?').run(status, id);
    if (!r.changes) return res.status(404).json({ error: 'Not found.' });
    audit(req, 'UPDATE_STATUS', 'bookings', id, `Status → ${status}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Update failed.' }); }
});

app.delete('/api/admin/bookings/:id', requireRole('admin', 'manager'), (req, res) => {
  try {
    const r = db.prepare('DELETE FROM bookings WHERE id=?').run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'Not found.' });
    audit(req, 'DELETE', 'bookings', req.params.id, null);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Delete failed.' }); }
});

// ════════════════════════════════════════════════════════════════
// ADMIN API — CONTACTS
// ════════════════════════════════════════════════════════════════

app.post('/api/admin/contacts/status', requireAuth, (req, res) => {
  try {
    const { id, status } = req.body;
    const r = db.prepare('UPDATE contacts SET status=? WHERE id=?').run(status, id);
    if (!r.changes) return res.status(404).json({ error: 'Not found.' });
    audit(req, 'UPDATE_STATUS', 'contacts', id, `Status → ${status}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Update failed.' }); }
});

app.delete('/api/admin/contacts/:id', requireRole('admin', 'manager'), (req, res) => {
  try {
    const r = db.prepare('DELETE FROM contacts WHERE id=?').run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'Not found.' });
    audit(req, 'DELETE', 'contacts', req.params.id, null);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Delete failed.' }); }
});

// ════════════════════════════════════════════════════════════════
// ADMIN API — USERS
// ════════════════════════════════════════════════════════════════

app.post('/api/admin/users', requireRole('admin'), (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || password.length < 6)
      return res.status(400).json({ error: 'Username and password (min 6 chars) required.' });
    if (db.prepare('SELECT id FROM users WHERE username=?').get(username))
      return res.status(400).json({ error: 'Username already exists.' });
    const validRoles = ['admin', 'manager', 'editor'];
    const assignedRole = validRoles.includes(role) ? role : 'editor';
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare('INSERT INTO users (username,password_hash,role) VALUES (?,?,?)').run(username, hash, assignedRole);
    audit(req, 'CREATE', 'users', r.lastInsertRowid, `Created user "${username}" with role "${assignedRole}"`);
    res.json({ success: true, userId: r.lastInsertRowid, role: assignedRole });
  } catch (err) { res.status(500).json({ error: 'Create failed.' }); }
});

app.delete('/api/admin/users/:id', requireRole('admin'), (req, res) => {
  try {
    if (parseInt(req.params.id) === req.session.adminId)
      return res.status(400).json({ error: 'Cannot delete your own account.' });
    const r = db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'User not found.' });
    audit(req, 'DELETE', 'users', req.params.id, null);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Delete failed.' }); }
});

app.post('/api/admin/users/change-password', requireAuth, (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword || newPassword.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const role = req.session.role || 'editor';
    if (role !== 'admin' && parseInt(userId) !== req.session.adminId)
      return res.status(403).json({ error: 'Can only change your own password.' });
    const r = db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(newPassword, 10), userId);
    if (!r.changes) return res.status(404).json({ error: 'User not found.' });
    audit(req, 'CHANGE_PASSWORD', 'users', userId, null);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Update failed.' }); }
});

// ════════════════════════════════════════════════════════════════
// ADMIN API — SETTINGS & IMAGES
// ════════════════════════════════════════════════════════════════

app.post('/api/admin/settings', requireAuth, (req, res) => {
  try {
    const stmt = db.prepare('UPDATE settings SET value=? WHERE key=?');
    let count = 0;
    for (const [key, value] of Object.entries(req.body)) {
      if (stmt.run(value, key).changes > 0) count++;
    }
    audit(req, 'UPDATE', 'settings', null, `Updated ${count} settings`);
    res.json({ success: true, updatedCount: count });
  } catch (err) { res.status(500).json({ error: 'Save failed.' }); }
});

const ALLOWED_IMG_FIELDS = ['hero_image','service_vax_image','service_fp_image','service_anc_image','service_autism_image'];

app.post('/api/admin/upload-setting-image', requireAuth, uploadImg.single('image'), (req, res) => {
  try {
    const { field } = req.body;
    if (!ALLOWED_IMG_FIELDS.includes(field)) {
      if (req.file) delFile('/uploads/' + req.file.filename);
      return res.status(400).json({ error: 'Invalid field.' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const newPath = '/uploads/' + req.file.filename;
    const old = db.prepare('SELECT value FROM settings WHERE key=?').get(field);
    db.prepare('UPDATE settings SET value=? WHERE key=?').run(newPath, field);
    if (old) delFile(old.value);
    audit(req, 'UPLOAD_IMAGE', 'settings', null, `Field: ${field}`);
    res.json({ success: true, path: newPath });
  } catch (err) { res.status(500).json({ error: 'Upload failed.' }); }
});

// ════════════════════════════════════════════════════════════════
// ADMIN API — SECTIONS
// ════════════════════════════════════════════════════════════════

app.post('/api/admin/sections', requireAuth, uploadImg.single('image'), (req, res) => {
  try {
    const { title, content, is_visible } = req.body;
    if (!title || !content) { if (req.file) delFile('/uploads/' + req.file.filename); return res.status(400).json({ error: 'Title and content required.' }); }
    const imagePath = req.file ? '/uploads/' + req.file.filename : null;
    const maxRow    = db.prepare('SELECT MAX(display_order) as m FROM sections').get();
    const r = db.prepare('INSERT INTO sections (title,content,image_path,display_order,is_visible) VALUES (?,?,?,?,?)').run(title, content, imagePath, (maxRow.m || 0) + 1, is_visible === '0' ? 0 : 1);
    audit(req, 'CREATE', 'sections', r.lastInsertRowid, `"${title}"`);
    res.json({ success: true, sectionId: r.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: 'Create failed.' }); }
});

app.post('/api/admin/sections/:id', requireAuth, uploadImg.single('image'), (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, is_visible } = req.body;
    if (!title || !content) { if (req.file) delFile('/uploads/' + req.file.filename); return res.status(400).json({ error: 'Title and content required.' }); }
    const existing = db.prepare('SELECT image_path FROM sections WHERE id=?').get(id);
    if (!existing) return res.status(404).json({ error: 'Not found.' });
    let imgPath = existing.image_path;
    if (req.file) { delFile(imgPath); imgPath = '/uploads/' + req.file.filename; }
    db.prepare('UPDATE sections SET title=?,content=?,image_path=?,is_visible=? WHERE id=?').run(title, content, imgPath, is_visible === '0' ? 0 : 1, id);
    audit(req, 'UPDATE', 'sections', id, `"${title}"`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Update failed.' }); }
});

app.delete('/api/admin/sections/:id', requireRole('admin', 'manager'), (req, res) => {
  try {
    const existing = db.prepare('SELECT image_path FROM sections WHERE id=?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found.' });
    db.prepare('DELETE FROM sections WHERE id=?').run(req.params.id);
    delFile(existing.image_path);
    audit(req, 'DELETE', 'sections', req.params.id, null);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Delete failed.' }); }
});

app.post('/api/admin/sections/:id/move', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { direction } = req.body;
    const curr = db.prepare('SELECT * FROM sections WHERE id=?').get(id);
    if (!curr) return res.status(404).json({ error: 'Not found.' });
    const neighbor = direction === 'up'
      ? db.prepare('SELECT * FROM sections WHERE display_order<? ORDER BY display_order DESC LIMIT 1').get(curr.display_order)
      : db.prepare('SELECT * FROM sections WHERE display_order>? ORDER BY display_order ASC LIMIT 1').get(curr.display_order);
    if (neighbor) {
      db.prepare('UPDATE sections SET display_order=? WHERE id=?').run(neighbor.display_order, curr.id);
      db.prepare('UPDATE sections SET display_order=? WHERE id=?').run(curr.display_order, neighbor.id);
    }
    res.json({ success: true, moved: !!neighbor });
  } catch (err) { res.status(500).json({ error: 'Reorder failed.' }); }
});

// ════════════════════════════════════════════════════════════════
// ADMIN API — VACCINES
// ════════════════════════════════════════════════════════════════

app.post('/api/admin/vaccines', requireAuth, (req, res) => {
  try {
    const { name, age_text, offset_days, diseases } = req.body;
    if (!name || !age_text || offset_days == null || offset_days === '') return res.status(400).json({ error: 'Name, age text, and offset days required.' });
    const maxRow = db.prepare('SELECT MAX(display_order) as m FROM vaccines').get();
    const r = db.prepare('INSERT INTO vaccines (name,age_text,offset_days,diseases,display_order) VALUES (?,?,?,?,?)').run(name, age_text, parseInt(offset_days, 10), diseases || '', (maxRow.m || 0) + 1);
    audit(req, 'CREATE', 'vaccines', r.lastInsertRowid, `"${name}"`);
    res.json({ success: true, vaccineId: r.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: 'Create failed.' }); }
});

app.post('/api/admin/vaccines/:id', requireAuth, (req, res) => {
  try {
    const { name, age_text, offset_days, diseases } = req.body;
    if (!name || !age_text || offset_days == null || offset_days === '') return res.status(400).json({ error: 'All fields required.' });
    const r = db.prepare('UPDATE vaccines SET name=?,age_text=?,offset_days=?,diseases=? WHERE id=?').run(name, age_text, parseInt(offset_days, 10), diseases || '', req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'Not found.' });
    audit(req, 'UPDATE', 'vaccines', req.params.id, `"${name}"`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Update failed.' }); }
});

app.delete('/api/admin/vaccines/:id', requireRole('admin', 'manager'), (req, res) => {
  try {
    const r = db.prepare('DELETE FROM vaccines WHERE id=?').run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'Not found.' });
    audit(req, 'DELETE', 'vaccines', req.params.id, null);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Delete failed.' }); }
});

// Move up/down within same offset_days group (fine-grained ordering for ties)
app.post('/api/admin/vaccines/:id/move', requireAuth, (req, res) => {
  try {
    const { direction } = req.body;
    const curr = db.prepare('SELECT * FROM vaccines WHERE id=?').get(req.params.id);
    if (!curr) return res.status(404).json({ error: 'Not found.' });
    // Only swap with adjacent vaccine that has the SAME offset_days
    const neighbor = direction === 'up'
      ? db.prepare('SELECT * FROM vaccines WHERE offset_days=? AND display_order<? ORDER BY display_order DESC LIMIT 1').get(curr.offset_days, curr.display_order)
      : db.prepare('SELECT * FROM vaccines WHERE offset_days=? AND display_order>? ORDER BY display_order ASC  LIMIT 1').get(curr.offset_days, curr.display_order);
    if (neighbor) {
      db.prepare('UPDATE vaccines SET display_order=? WHERE id=?').run(neighbor.display_order, curr.id);
      db.prepare('UPDATE vaccines SET display_order=? WHERE id=?').run(curr.display_order, neighbor.id);
    }
    res.json({ success: true, moved: !!neighbor });
  } catch (err) { res.status(500).json({ error: 'Reorder failed.' }); }
});

// ════════════════════════════════════════════════════════════════
// ADMIN API — EVENTS
// ════════════════════════════════════════════════════════════════

const EVENT_FIELDS = [{ name: 'cover_image', maxCount: 1 }, { name: 'pdf_file', maxCount: 1 }];

app.post('/api/admin/events', requireAuth, uploadEvent.fields(EVENT_FIELDS), (req, res) => {
  try {
    const { title, description, event_date, event_time, location, category, is_published } = req.body;
    if (!title || !description || !event_date) return res.status(400).json({ error: 'Title, description, and date required.' });
    const cover_image = req.files?.cover_image ? '/uploads/events/' + req.files.cover_image[0].filename : null;
    const pdf_path    = req.files?.pdf_file    ? '/uploads/events/' + req.files.pdf_file[0].filename    : null;
    const r = db.prepare('INSERT INTO events (title,description,event_date,event_time,location,category,cover_image,pdf_path,is_published) VALUES (?,?,?,?,?,?,?,?,?)').run(title, description, event_date, event_time || '', location || '', category || 'General', cover_image, pdf_path, is_published === '1' ? 1 : 0);
    audit(req, 'CREATE', 'events', r.lastInsertRowid, `"${title}"`);
    res.json({ success: true, eventId: r.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: 'Create failed.' }); }
});

app.post('/api/admin/events/:id', requireAuth, uploadEvent.fields(EVENT_FIELDS), (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, event_date, event_time, location, category, is_published } = req.body;
    if (!title || !description || !event_date) return res.status(400).json({ error: 'Required fields missing.' });
    const existing = db.prepare('SELECT * FROM events WHERE id=?').get(id);
    if (!existing) return res.status(404).json({ error: 'Not found.' });
    let cover_image = existing.cover_image;
    let pdf_path    = existing.pdf_path;
    if (req.files?.cover_image) { delFile(cover_image); cover_image = '/uploads/events/' + req.files.cover_image[0].filename; }
    if (req.files?.pdf_file)    { delFile(pdf_path);    pdf_path    = '/uploads/events/' + req.files.pdf_file[0].filename;    }
    db.prepare('UPDATE events SET title=?,description=?,event_date=?,event_time=?,location=?,category=?,cover_image=?,pdf_path=?,is_published=? WHERE id=?').run(title, description, event_date, event_time || '', location || '', category || 'General', cover_image, pdf_path, is_published === '1' ? 1 : 0, id);
    audit(req, 'UPDATE', 'events', id, `"${title}"`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Update failed.' }); }
});

app.post('/api/admin/events/:id/publish', requireAuth, (req, res) => {
  try {
    const ev = db.prepare('SELECT is_published FROM events WHERE id=?').get(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Not found.' });
    const newStatus = ev.is_published ? 0 : 1;
    db.prepare('UPDATE events SET is_published=? WHERE id=?').run(newStatus, req.params.id);
    audit(req, newStatus ? 'PUBLISH' : 'UNPUBLISH', 'events', req.params.id, null);
    res.json({ success: true, is_published: newStatus });
  } catch (err) { res.status(500).json({ error: 'Toggle failed.' }); }
});

app.delete('/api/admin/events/:id', requireRole('admin', 'manager'), (req, res) => {
  try {
    const ev = db.prepare('SELECT * FROM events WHERE id=?').get(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Not found.' });
    delFile(ev.cover_image); delFile(ev.pdf_path);
    db.prepare('DELETE FROM events WHERE id=?').run(req.params.id);
    audit(req, 'DELETE', 'events', req.params.id, null);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Delete failed.' }); }
});

// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// PUBLIC API — RESOURCES
// ════════════════════════════════════════════════════════════════

app.get('/api/resources', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM resources WHERE is_visible=1 ORDER BY display_order ASC, id ASC').all();
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

// Download — forces browser save dialog with original filename
app.get('/api/resources/:id/download', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM resources WHERE id=? AND is_visible=1').get(req.params.id);
    if (!row || !row.file_path) return res.status(404).json({ error: 'File not found.' });
    const fp = path.join(__dirname, 'public', row.file_path);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File not found.' });
    const safeName = (row.original_filename || path.basename(row.file_path)).replace(/[^\w\s.\-()]/g, '_');
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Content-Disposition', 'attachment; filename="' + safeName + '"');
    res.sendFile(fp);
  } catch (err) { res.status(500).json({ error: 'Download failed.' }); }
});

// ════════════════════════════════════════════════════════════════
// ADMIN API — RESOURCES CRUD
// ════════════════════════════════════════════════════════════════

app.post('/api/admin/resources', requireAuth, (req, res) => {
  try {
    const { title, type, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required.' });
    const maxRow = db.prepare('SELECT MAX(display_order) as m FROM resources').get();
    const r = db.prepare('INSERT INTO resources (title, type, description, display_order) VALUES (?,?,?,?)')
      .run(title.trim(), (type || 'GUIDE').trim(), (description || '').trim(), (maxRow.m || 0) + 1);
    audit(req, 'CREATE', 'resources', r.lastInsertRowid, '"' + title + '"');
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: 'Create failed.' }); }
});

app.post('/api/admin/resources/:id/meta', requireAuth, (req, res) => {
  try {
    const { title, type, description, is_visible } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required.' });
    const r = db.prepare('UPDATE resources SET title=?, type=?, description=?, is_visible=? WHERE id=?')
      .run(title.trim(), (type || 'GUIDE').trim(), (description || '').trim(), is_visible === '0' ? 0 : 1, req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'Not found.' });
    audit(req, 'UPDATE', 'resources', req.params.id, '"' + title + '"');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Update failed.' }); }
});

app.delete('/api/admin/resources/:id', requireRole('admin', 'manager'), (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM resources WHERE id=?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found.' });
    if (row.file_path) delFile(row.file_path);
    db.prepare('DELETE FROM resources WHERE id=?').run(req.params.id);
    audit(req, 'DELETE', 'resources', req.params.id, '"' + row.title + '"');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Delete failed.' }); }
});

app.post('/api/admin/resources/:id/file', requireAuth, uploadResource.single('file'), (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM resources WHERE id=?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found.' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    if (row.file_path) delFile(row.file_path);
    const newPath = '/uploads/resources/' + req.file.filename;
    db.prepare('UPDATE resources SET file_path=?, original_filename=? WHERE id=?')
      .run(newPath, req.file.originalname, req.params.id);
    audit(req, 'UPLOAD_FILE', 'resources', req.params.id, req.file.originalname);
    res.json({ success: true, path: newPath, original_filename: req.file.originalname });
  } catch (err) { res.status(500).json({ error: 'Upload failed.' }); }
});

app.delete('/api/admin/resources/:id/file', requireRole('admin', 'manager'), (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM resources WHERE id=?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found.' });
    if (row.file_path) delFile(row.file_path);
    db.prepare("UPDATE resources SET file_path='', original_filename='' WHERE id=?").run(req.params.id);
    audit(req, 'DELETE_FILE', 'resources', req.params.id, null);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Delete failed.' }); }
});

// ════════════════════════════════════════════════════════════════
// ERROR HANDLER
// ════════════════════════════════════════════════════════════════

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'File too large (max 50 MB for PDFs, 5 MB for images).'
      : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err && err.status === 400) {
    return res.status(400).json({ error: err.message });
  }
  console.error('Unhandled:', err);
  res.status(500).json({ error: err.message || 'Unexpected error.' });
});

// Start with HTTPS if mkcert certificates exist in ./certs/, otherwise HTTP.
// To generate certs: mkcert -install && mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost 127.0.0.1
const CERT = path.join(__dirname, 'certs', 'localhost.pem');
const KEY  = path.join(__dirname, 'certs', 'localhost-key.pem');

if (fs.existsSync(CERT) && fs.existsSync(KEY)) {
  require('https').createServer({ cert: fs.readFileSync(CERT), key: fs.readFileSync(KEY) }, app)
    .listen(PORT, () => console.log(`Bliss Bangladesh → https://localhost:${PORT}`));
} else {
  app.listen(PORT, () => console.log(`Bliss Bangladesh → http://localhost:${PORT} (no certs — run mkcert for HTTPS)`));
}
