const express = require('express');
const db = require('../db/database');
const { getBadges } = require('../utils/badges');

const router = express.Router();

function resolveAvatar(user) {
  if (user.avatar_source === 'discord' && user.discord_avatar) {
    return { url: user.discord_avatar, type: 'image' };
  }
  if (user.avatar_source === 'google' && user.google_avatar) {
    return { url: user.google_avatar, type: 'image' };
  }
  return { url: user.avatar_url, type: user.avatar_type };
}

function renderProfile(req, res, username) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get((username || '').toLowerCase());
  if (!user) {
    return res.status(404).render('404');
  }

  // ----- عداد زيارات فريد: كل زائر يُحسب مرة وحدة بس (عبر كوكي) -----
  const cookieName = `seen_${user.id}`;
  if (!req.cookies || !req.cookies[cookieName]) {
    db.prepare('UPDATE users SET views = views + 1 WHERE id = ?').run(user.id);
    user.views += 1;
    res.cookie(cookieName, '1', { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true });
  }

  const links = db.prepare('SELECT * FROM links WHERE user_id = ? ORDER BY sort_order ASC, id ASC').all(user.id);
  const avatar = resolveAvatar(user);
  res.render('profile', { profile: user, links, badges: getBadges(user), avatar });
}

// الوصول عبر المسار: /u/username
router.get('/u/:username', (req, res) => {
  renderProfile(req, res, req.params.username);
});

module.exports = { router, renderProfile };
