const db = require('../db/database');

function expirePremiumIfNeeded(userId) {
  db.prepare(`
    UPDATE users SET is_premium = 0
    WHERE id = ? AND is_premium = 1 AND premium_expires_at IS NOT NULL AND premium_expires_at < datetime('now')
  `).run(userId);
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  expirePremiumIfNeeded(req.session.userId);
  next();
}

function redirectIfAuth(req, res, next) {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.session.userId);
  if (!user || !user.is_admin) {
    return res.status(403).render('403');
  }
  next();
}

module.exports = { requireAuth, redirectIfAuth, requireAdmin };
