const express = require('express');
const db = require('../db/database');

const router = express.Router();

const DISCORD_API = 'https://discord.com/api';

function requireDiscordConfig(req, res, next) {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_REDIRECT_URI) {
    return res.status(500).send(
      'إعدادات Discord OAuth غير مكتملة. تأكد من تعبئة DISCORD_CLIENT_ID و DISCORD_CLIENT_SECRET و DISCORD_REDIRECT_URI في ملف .env — راجع README.md لطريقة إنشاء تطبيق Discord.'
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

// ----- ابدأ تسجيل الدخول عبر Discord -----
router.get('/auth/discord', requireDiscordConfig, (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email',
    prompt: 'consent'
  });
  // إذا المستخدم مسجل دخول حالياً، هذا يعتبر "ربط حساب" وليس تسجيل دخول جديد
  if (req.session.userId) {
    params.set('state', 'link');
  }
  res.redirect(`${DISCORD_API}/oauth2/authorize?${params.toString()}`);
});

// ----- استقبال الرد من Discord -----
router.get('/auth/discord/callback', requireDiscordConfig, async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.redirect('/login?discord_error=1');

  try {
    // 1) استبدال الكود بتوكن وصول
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      })
    });
    if (!tokenRes.ok) throw new Error('token exchange failed');
    const tokenData = await tokenRes.json();

    // 2) جلب معلومات المستخدم من Discord
    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    if (!userRes.ok) throw new Error('fetch discord user failed');
    const dUser = await userRes.json();

    const discordAvatar = dUser.avatar
      ? `https://cdn.discordapp.com/avatars/${dUser.id}/${dUser.avatar}.png?size=256`
      : '';
    const discordUsername = dUser.username;

    // ----- حالة: ربط حساب Discord بحساب مسجّل دخول حالياً -----
    if (state === 'link' && req.session.userId) {
      const takenByOther = db.prepare('SELECT id FROM users WHERE discord_id = ? AND id != ?').get(dUser.id, req.session.userId);
      if (takenByOther) {
        return res.redirect('/dashboard?msg=حساب+Discord+هذا+مرتبط+بمستخدم+آخر+مسبقاً');
      }
      db.prepare('UPDATE users SET discord_id = ?, discord_username = ?, discord_avatar = ? WHERE id = ?')
        .run(dUser.id, discordUsername, discordAvatar, req.session.userId);
      return res.redirect('/dashboard?msg=تم+ربط+حساب+Discord+بنجاح');
    }

    // ----- حالة: تسجيل دخول / إنشاء حساب عبر Discord -----
    let user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(dUser.id);

    if (!user) {
      // لو فيه حساب موجود مسبقاً بنفس الإيميل (تسجيل يدوي أو عبر Google)، اربط Discord فيه بدل إنشاء حساب مكرر
      const existingByEmail = dUser.email ? db.prepare('SELECT * FROM users WHERE email = ?').get(dUser.email) : null;

      if (existingByEmail) {
        db.prepare('UPDATE users SET discord_id = ?, discord_username = ?, discord_avatar = ? WHERE id = ?')
          .run(dUser.id, discordUsername, discordAvatar, existingByEmail.id);
        user = existingByEmail;
      } else {
        const username = uniqueUsernameFrom(discordUsername);
        const email = dUser.email || `${dUser.id}@discord.local`;
        const info = db.prepare(`
          INSERT INTO users (username, email, password_hash, display_name, avatar_url, discord_id, discord_username, discord_avatar)
          VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
        `).run(username, email, discordUsername, discordAvatar, dUser.id, discordUsername, discordAvatar);
        user = { id: info.lastInsertRowid };

        const admins = (process.env.ADMIN_USERNAMES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        if (admins.includes(username.toLowerCase())) {
          db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id);
        }
      }
    }

    req.session.userId = user.id;
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Discord OAuth error:', err.message);
    res.redirect('/login?discord_error=1');
  }
});

module.exports = router;
