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
  const premiumRequests = db.prepare(`
    SELECT premium_requests.*, users.username FROM premium_requests
    JOIN users ON users.id = premium_requests.user_id
    WHERE premium_requests.status = 'pending'
    ORDER BY premium_requests.id ASC
  `).all();
  res.render('admin', { users, q, message: req.query.msg || null, premiumRequests });
});

// ----- تغيير يوزرنيم أي مستخدم (الأدمن بس يقدر يستخدم حرف واحد) -----
router.post('/admin/users/:id/username', requireAdmin, (req, res) => {
  const newUsername = (req.body.new_username || '').trim().toLowerCase();

  if (!/^[a-z0-9._]{1,20}$/.test(newUsername)) {
    return res.redirect('/admin?msg=يوزرنيم+غير+صالح+(حروف/أرقام/نقطة/شرطة+سفلية+فقط)');
  }
  if (/^[._]|[._]$/.test(newUsername) || /[._]{2,}/.test(newUsername)) {
    return res.redirect('/admin?msg=ما+يجوز+يبدأ/ينتهي+بنقطة+أو+شرطة+سفلية+متكررة');
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(newUsername, req.params.id);
  if (existing) {
    return res.redirect('/admin?msg=اليوزرنيم+هذا+مستخدم+من+شخص+ثاني');
  }
  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newUsername, req.params.id);
  res.redirect('/admin?msg=تم+تغيير+اليوزرنيم+✅');
});

router.post('/admin/users/:id/toggle-premium', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT is_premium FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.redirect('/admin');
  const newVal = user.is_premium ? 0 : 1;
  const expires = newVal ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;
  db.prepare('UPDATE users SET is_premium = ?, premium_since = ?, premium_expires_at = ? WHERE id = ?')
    .run(newVal, newVal ? new Date().toISOString() : null, expires, req.params.id);
  res.redirect('/admin?msg=تم+تحديث+حالة+Premium');
});

// ----- الموافقة على طلب اشتراك CliQ: تفعيل بريميوم 30 يوم -----
router.post('/admin/premium-requests/:id/approve', requireAdmin, (req, res) => {
  const request = db.prepare('SELECT * FROM premium_requests WHERE id = ?').get(req.params.id);
  if (!request || request.status !== 'pending') return res.redirect('/admin?msg=الطلب+غير+موجود');
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET is_premium = 1, premium_since = ?, premium_expires_at = ? WHERE id = ?')
    .run(new Date().toISOString(), expires, request.user_id);
  db.prepare("UPDATE premium_requests SET status = 'approved', reviewed_at = datetime('now') WHERE id = ?")
    .run(request.id);
  res.redirect('/admin?msg=تم+قبول+الطلب+وتفعيل+Premium+لمدة+30+يوم');
});

router.post('/admin/premium-requests/:id/reject', requireAdmin, (req, res) => {
  db.prepare("UPDATE premium_requests SET status = 'rejected', reviewed_at = datetime('now') WHERE id = ?")
    .run(req.params.id);
  res.redirect('/admin?msg=تم+رفض+الطلب');
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
