const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/admin', requireAdmin, (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  let users;
  if (q) {
    users = db.prepare('SELECT * FROM users WHERE username LIKE ? OR email LIKE ? ORDER BY id DESC')
      .all(`%${q}%`, `%${q}%`);
  } else {
    users = db.prepare('SELECT * FROM users ORDER BY id DESC').all();
  }
  res.render('admin', { users, q, message: req.query.msg || null });
});

router.post('/admin/users/:id/toggle-premium', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT is_premium FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.redirect('/admin');
  const newVal = user.is_premium ? 0 : 1;
  db.prepare('UPDATE users SET is_premium = ?, premium_since = ? WHERE id = ?')
    .run(newVal, newVal ? new Date().toISOString() : null, req.params.id);
  res.redirect('/admin?msg=تم+تحديث+حالة+Premium');
});

router.post('/admin/users/:id/toggle-verified', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT is_verified FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.redirect('/admin');
  db.prepare('UPDATE users SET is_verified = ? WHERE id = ?').run(user.is_verified ? 0 : 1, req.params.id);
  res.redirect('/admin?msg=تم+تحديث+حالة+التوثيق');
});

router.post('/admin/users/:id/toggle-admin', requireAdmin, (req, res) => {
  // منع الأدمن من إلغاء صلاحيته عن نفسه بالغلط
  if (Number(req.params.id) === req.session.userId) {
    return res.redirect('/admin?msg=ما+تقدر+تشيل+صلاحية+الأدمن+عن+نفسك');
  }
  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.redirect('/admin');
  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(user.is_admin ? 0 : 1, req.params.id);
  res.redirect('/admin?msg=تم+تحديث+صلاحية+الأدمن');
});

module.exports = router;
