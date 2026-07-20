const express = require('express');
const db = require('../db/database');

const router = express.Router();

function requireGoogleConfig(req, res, next) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    return res.status(500).send(
      'إعدادات Google OAuth غير مكتملة. تأكد من تعبئة GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET و GOOGLE_REDIRECT_URI في ملف .env — راجع README.md لطريقة إنشاء تطبيق Google.'
    );
  }
  next();
}

function sanitizeUsername(raw) {
  let base = (raw || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (base.length < 3) base = 'user' + base;
  return base.slice(0, 15);
}

function uniqueUsernameFrom(raw) {
  const base = sanitizeUsername(raw);
  let candidate = base;
  let i = 0;
  while (db.prepare('SELECT id FROM users WHERE username = ?').get(candidate)) {
    i++;
    candidate = `${base}${i}`.slice(0, 20);
  }
  return candidate;
}

// ----- ابدأ تسجيل الدخول عبر Google -----
router.get('/auth/google', requireGoogleConfig, (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    access_type: 'online'
  });
  if (req.session.userId) {
    params.set('state', 'link');
  }
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// ----- استقبال الرد من Google -----
router.get('/auth/google/callback', requireGoogleConfig, async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.redirect('/login?google_error=1');

  try {
    // 1) استبدال الكود بتوكن وصول
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI
      })
    });
    if (!tokenRes.ok) throw new Error('token exchange failed');
    const tokenData = await tokenRes.json();

    // 2) جلب معلومات المستخدم من Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    if (!userRes.ok) throw new Error('fetch google user failed');
    const gUser = await userRes.json();

    const googleAvatar = gUser.picture || '';
    const googleEmail = gUser.email || '';

    // ----- حالة: ربط حساب Google بحساب مسجّل دخول حالياً -----
    if (state === 'link' && req.session.userId) {
      const takenByOther = db.prepare('SELECT id FROM users WHERE google_id = ? AND id != ?').get(gUser.id, req.session.userId);
      if (takenByOther) {
        return res.redirect('/dashboard?msg=حساب+Google+هذا+مرتبط+بمستخدم+آخر+مسبقاً');
      }
      db.prepare('UPDATE users SET google_id = ?, google_email = ?, google_avatar = ? WHERE id = ?')
        .run(gUser.id, googleEmail, googleAvatar, req.session.userId);
      return res.redirect('/dashboard?msg=تم+ربط+حساب+Google+بنجاح');
    }

    // ----- حالة: تسجيل دخول / إنشاء حساب عبر Google -----
    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(gUser.id);

    if (!user) {
      const usernameSeed = googleEmail ? googleEmail.split('@')[0] : gUser.name;
      const username = uniqueUsernameFrom(usernameSeed);
      const email = googleEmail || `${gUser.id}@google.local`;
      const info = db.prepare(`
        INSERT INTO users (username, email, password_hash, display_name, avatar_url, google_id, google_email, google_avatar)
        VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
      `).run(username, email, gUser.name || username, googleAvatar, gUser.id, googleEmail, googleAvatar);
      user = { id: info.lastInsertRowid };

      const admins = (process.env.ADMIN_USERNAMES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      if (admins.includes(username.toLowerCase())) {
        db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id);
      }
    }

    req.session.userId = user.id;
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Google OAuth error:', err.message);
    res.redirect('/login?google_error=1');
  }
});

module.exports = router;
