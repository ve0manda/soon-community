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
  res.render('admin', {
    users,
    q,
    message: req.query.msg || null,
    siteAccent: db.getSetting('site_accent', '#a01c2c'),
    siteBg: db.getSetting('site_void', '#0b0709')
  });
});

function toggleField(field) {
  return (req, res) => {
    const row = db.prepare(`SELECT ${field} FROM users WHERE id = ?`).get(req.params.id);
    if (!row) return res.redirect('/admin');
    db.prepare(`UPDATE users SET ${field} = ? WHERE id = ?`).run(row[field] ? 0 : 1, req.params.id);
    res.redirect('/admin?msg=تم+التحديث');
  };
}

router.post('/admin/users/:id/toggle-premium', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT is_premium FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.redirect('/admin');
  const newVal = user.is_premium ? 0 : 1;
  db.prepare('UPDATE users SET is_premium = ?, premium_since = ? WHERE id = ?')
    .run(newVal, newVal ? new Date().toISOString() : null, req.params.id);
  res.redirect('/admin?msg=تم+تحديث+حالة+Premium');
});

router.post('/admin/users/:id/toggle-verified', requireAdmin, toggleField('is_verified'));
router.post('/admin/users/:id/toggle-member', requireAdmin, toggleField('is_member'));

router.post('/admin/users/:id/toggle-og', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT og_override, id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.redirect('/admin');
  // دورة: تلقائي (NULL) -> فرض تفعيل (1) -> فرض إلغاء (0) -> تلقائي...
  let next;
  if (user.og_override === null) next = 1;
  else if (user.og_override === 1) next = 0;
  else next = null;
  db.prepare('UPDATE users SET og_override = ? WHERE id = ?').run(next, req.params.id);
  res.redirect('/admin?msg=تم+تحديث+شارة+OG');
});

router.post('/admin/users/:id/toggle-admin', requireAdmin, (req, res) => {
  if (Number(req.params.id) === req.session.userId) {
    return res.redirect('/admin?msg=ما+تقدر+تشيل+صلاحية+الأدمن+عن+نفسك');
  }
  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.redirect('/admin');
  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(user.is_admin ? 0 : 1, req.params.id);
  res.redirect('/admin?msg=تم+تحديث+صلاحية+الأدمن');
});

// ----- تحكم الأدمن بألوان الموقع العامة (النافبار، الأزرار، الصفحة الرئيسية...) -----
router.post('/admin/site-settings', requireAdmin, (req, res) => {
  const { site_accent, site_void } = req.body;
  if (site_accent) db.setSetting('site_accent', site_accent);
  if (site_void) db.setSetting('site_void', site_void);
  res.redirect('/admin?msg=تم+تحديث+ألوان+الموقع');
});

module.exports = router;
