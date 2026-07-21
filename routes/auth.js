const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { redirectIfAuth } = require('../middleware/auth');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9._]{2,20}$/;

function getAdminUsernames() {
  return (process.env.ADMIN_USERNAMES || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function maybePromoteToAdmin(username) {
  const admins = getAdminUsernames();
  if (admins.includes(username.toLowerCase())) {
    db.prepare('UPDATE users SET is_admin = 1 WHERE username = ?').run(username.toLowerCase());
  }
}

router.get('/register', redirectIfAuth, (req, res) => {
  res.render('register', { error: null });
});

router.post('/register', redirectIfAuth, (req, res) => {
  const { username, email, password, confirm_password } = req.body;

  if (!username || !email || !password) {
    return res.render('register', { error: 'كل الحقول مطلوبة' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.render('register', { error: 'اسم المستخدم يجب أن يكون حرفين على الأقل (20 كحد أقصى)، ويسمح فقط بحروف/أرقام/نقطة/شرطة سفلية' });
  }
  if (/^[._]|[._]$/.test(username) || /[._]{2,}/.test(username)) {
    return res.render('register', { error: 'اسم المستخدم ما يجوز يبدأ أو ينتهي بنقطة/شرطة سفلية، ولا يحتوي عليهم متكررين' });
  }
  if (password.length < 6) {
    return res.render('register', { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
  }
  if (password !== confirm_password) {
    return res.render('register', { error: 'كلمتا المرور غير متطابقتين' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username.toLowerCase(), email.toLowerCase());
  if (existing) {
    return res.render('register', { error: 'اسم المستخدم أو البريد الإلكتروني مستخدم مسبقاً' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)'
  ).run(username.toLowerCase(), email.toLowerCase(), hash, username);

  maybePromoteToAdmin(username);
  req.session.userId = info.lastInsertRowid;
  res.redirect('/dashboard');
});

router.get('/login', redirectIfAuth, (req, res) => {
  let error = null;
  if (req.query.discord_error) error = 'صار خطأ أثناء تسجيل الدخول عبر Discord، جرب مرة ثانية';
  if (req.query.google_error) error = 'صار خطأ أثناء تسجيل الدخول عبر Google، جرب مرة ثانية';
  res.render('login', { error });
});

router.post('/login', redirectIfAuth, (req, res) => {
  const { identifier, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?')
    .get((identifier || '').toLowerCase(), (identifier || '').toLowerCase());

  if (!user || !user.password_hash) {
    return res.render('login', { error: 'بيانات الدخول غير صحيحة، أو هذا الحساب مسجّل عبر Discord فقط — جرب زر "دخول عبر Discord"' });
  }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.render('login', { error: 'بيانات الدخول غير صحيحة' });
  }

  maybePromoteToAdmin(user.username);
  req.session.userId = user.id;
  res.redirect('/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
