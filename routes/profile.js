const express = require('express');
const db = require('../db/database');
const { getBadges } = require('../utils/badges');

const router = express.Router();

function renderProfile(req, res, username) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get((username || '').toLowerCase());
  if (!user) {
    return res.status(404).render('404');
  }
  // زيادة عداد الزيارات مرة واحدة فقط لكل زائر (نتتبعها بالجلسة/الكوكي)
  if (!req.session.visitedProfiles) req.session.visitedProfiles = {};
  if (!req.session.visitedProfiles[user.id]) {
    db.prepare('UPDATE users SET views = views + 1 WHERE id = ?').run(user.id);
    req.session.visitedProfiles[user.id] = true;
    user.views += 1; // نعكسها فوراً بالصفحة المعروضة حالياً
  }
  const links = db.prepare('SELECT * FROM links WHERE user_id = ? ORDER BY sort_order ASC, id ASC').all(user.id);
  res.render('profile', { profile: user, links, badges: getBadges(user) });
}

// الوصول عبر المسار: /u/username
router.get('/u/:username', (req, res) => {
  renderProfile(req, res, req.params.username);
});

module.exports = { router, renderProfile };
