const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { getBadges, FREE_LINKS_LIMIT } = require('../utils/badges');

const router = express.Router();

function storageFor(folder) {
  const dir = path.join(__dirname, '..', 'uploads', folder);
  fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${req.session.userId}_${Date.now()}${ext}`);
    }
  });
}

const avatarUpload = multer({
  storage: storageFor('avatars'),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/|^video\//.test(file.mimetype))
});

const backgroundUpload = multer({
  storage: storageFor('backgrounds'),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/|^video\//.test(file.mimetype))
});

const audioUpload = multer({
  storage: storageFor('audio'),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^audio\//.test(file.mimetype))
});

const proofUpload = multer({
  storage: storageFor('payment-proofs'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
});

router.get('/dashboard', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  const links = db.prepare('SELECT * FROM links WHERE user_id = ? ORDER BY sort_order ASC, id ASC').all(user.id);
  const pendingRequest = db.prepare(
    "SELECT * FROM premium_requests WHERE user_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1"
  ).get(user.id);
  res.render('dashboard', {
    user,
    links,
    badges: getBadges(user),
    linksLimit: user.is_premium ? null : FREE_LINKS_LIMIT,
    message: req.query.msg || null,
    pendingRequest,
    cliqAlias: process.env.CLIQ_ALIAS || 'ضع-alias-الدفع-هنا'
  });
});

router.post('/dashboard/profile', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  let { display_name, bio, bg_color, accent_color, text_color, effect, cursor_effect, background_type } = req.body;

  // تأثير المؤشر (glow) ميزة Premium فقط
  if (cursor_effect === 'glow' && !user.is_premium) {
    cursor_effect = 'none';
  }
  // خلفية الفيديو ميزة Premium فقط — إذا الحساب مجاني وما عنده فيديو مرفوع مسبقاً، رجعه صورة/لون
  if (background_type === 'video' && !user.is_premium) {
    background_type = user.background_type === 'video' ? 'color' : background_type;
  }

  db.prepare(`UPDATE users SET display_name = ?, bio = ?, bg_color = ?, accent_color = ?, text_color = ?,
              effect = ?, cursor_effect = ?, background_type = ? WHERE id = ?`)
    .run(display_name, bio, bg_color, accent_color, text_color, effect, cursor_effect, background_type, req.session.userId);
  res.redirect('/dashboard?msg=تم حفظ التغييرات بنجاح');
});

router.post('/dashboard/avatar', requireAuth, (req, res) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'الملف+كبير+جداً+(الحد+الأقصى+20MB)' : 'صيغة+الملف+غير+مدعومة';
      return res.redirect(`/dashboard?msg=فشل+رفع+الصورة+—+${msg}`);
    }
    if (!req.file) {
      return res.redirect('/dashboard?msg=لم+يتم+اختيار+ملف+—+صيغة+الصورة+غير+مدعومة+أو+لم+تُختر');
    }
    const user = db.prepare('SELECT is_premium FROM users WHERE id = ?').get(req.session.userId);
    const isVideo = req.file.mimetype.startsWith('video');
    if (isVideo && !user.is_premium) {
      fs.unlinkSync(req.file.path);
      return res.redirect('/dashboard?msg=صورة+البروفايل+المتحركة+(فيديو)+متاحة+لحسابات+Premium+فقط');
    }
    const url = `/uploads/avatars/${req.file.filename}`;
    const type = isVideo ? 'video' : 'image';
    db.prepare('UPDATE users SET avatar_url = ?, avatar_type = ? WHERE id = ?').run(url, type, req.session.userId);
    res.redirect('/dashboard?msg=تم تحديث الصورة الشخصية بنجاح ✅');
  });
});

router.post('/dashboard/background', requireAuth, (req, res) => {
  backgroundUpload.single('background')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'الملف+كبير+جداً+(الحد+الأقصى+25MB)' : 'صيغة+الملف+غير+مدعومة';
      return res.redirect(`/dashboard?msg=فشل+رفع+الخلفية+—+${msg}`);
    }
    if (!req.file) {
      return res.redirect('/dashboard?msg=لم+يتم+اختيار+ملف+—+صيغة+الخلفية+غير+مدعومة+أو+لم+تُختر');
    }
    const user = db.prepare('SELECT is_premium FROM users WHERE id = ?').get(req.session.userId);
    const isVideo = req.file.mimetype.startsWith('video');
    if (isVideo && !user.is_premium) {
      fs.unlinkSync(req.file.path);
      return res.redirect('/dashboard?msg=خلفيات+الفيديو+متاحة+لحسابات+Premium+فقط');
    }
    const url = `/uploads/backgrounds/${req.file.filename}`;
    const type = isVideo ? 'video' : 'image';
    db.prepare('UPDATE users SET background_url = ?, background_type = ? WHERE id = ?')
      .run(url, type, req.session.userId);
    res.redirect('/dashboard?msg=تم تحديث الخلفية بنجاح ✅');
  });
});

router.post('/dashboard/audio', requireAuth, (req, res) => {
  audioUpload.single('audio')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'الملف+كبير+جداً+(الحد+الأقصى+15MB)' : 'صيغة+الملف+غير+مدعومة';
      return res.redirect(`/dashboard?msg=فشل+رفع+الموسيقى+—+${msg}`);
    }
    if (!req.file) {
      return res.redirect('/dashboard?msg=لم+يتم+اختيار+ملف+—+صيغة+الصوت+غير+مدعومة+أو+لم+تُختر');
    }
    const url = `/uploads/audio/${req.file.filename}`;
    db.prepare('UPDATE users SET audio_url = ? WHERE id = ?').run(url, req.session.userId);
    res.redirect('/dashboard?msg=تم تحديث الموسيقى بنجاح ✅');
  });
});

// ----- Links CRUD -----
router.post('/dashboard/links/add', requireAuth, (req, res) => {
  const user = db.prepare('SELECT is_premium FROM users WHERE id = ?').get(req.session.userId);
  const { label, url, icon } = req.body;

  if (!user.is_premium) {
    const count = db.prepare('SELECT COUNT(*) as c FROM links WHERE user_id = ?').get(req.session.userId).c;
    if (count >= FREE_LINKS_LIMIT) {
      return res.redirect(`/dashboard?msg=الحسابات+المجانية+محدودة+بـ+${FREE_LINKS_LIMIT}+روابط+—+رقّي+لـ+Premium+لإضافة+المزيد`);
    }
  }

  if (label && url) {
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM links WHERE user_id = ?').get(req.session.userId);
    db.prepare('INSERT INTO links (user_id, label, url, icon, sort_order) VALUES (?, ?, ?, ?, ?)')
      .run(req.session.userId, label, url, icon || 'link', (maxOrder.m || 0) + 1);
  }
  res.redirect('/dashboard?msg=تمت إضافة الرابط');
});

router.post('/dashboard/links/delete/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM links WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  res.redirect('/dashboard?msg=تم حذف الرابط');
});

// ----- فك ربط حساب Discord -----
router.post('/dashboard/discord/unlink', requireAuth, (req, res) => {
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.session.userId);
  if (!user.password_hash) {
    return res.redirect('/dashboard?msg=لا+يمكنك+فك+الربط+—+حسابك+ما+عنده+كلمة+مرور،+Discord+هو+الطريقة+الوحيدة+لدخولك');
  }
  db.prepare("UPDATE users SET discord_id = NULL, discord_username = '', discord_avatar = '' WHERE id = ?")
    .run(req.session.userId);
  res.redirect('/dashboard?msg=تم+فك+ربط+حساب+Discord');
});

router.post('/dashboard/google/unlink', requireAuth, (req, res) => {
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.session.userId);
  if (!user.password_hash) {
    return res.redirect('/dashboard?msg=لا+يمكنك+فك+الربط+—+حسابك+ما+عنده+كلمة+مرور،+Google+هو+الطريقة+الوحيدة+لدخولك');
  }
  db.prepare("UPDATE users SET google_id = NULL, google_email = '', google_avatar = '' WHERE id = ?")
    .run(req.session.userId);
  res.redirect('/dashboard?msg=تم+فك+ربط+حساب+Google');
});

// ----- تقديم طلب اشتراك بريميوم عبر CliQ (يدوي، يراجعه الأدمن) -----
router.post('/dashboard/premium/request', requireAuth, (req, res) => {
  proofUpload.single('proof')(req, res, (err) => {
    if (err || !req.file) {
      return res.redirect('/dashboard?msg=فشل+رفع+إثبات+الدفع+—+تأكد+إنها+صورة+وحجمها+مناسب#premium');
    }
    const existing = db.prepare(
      "SELECT id FROM premium_requests WHERE user_id = ? AND status = 'pending'"
    ).get(req.session.userId);
    if (existing) {
      fs.unlinkSync(req.file.path);
      return res.redirect('/dashboard?msg=عندك+طلب+قيد+المراجعة+بالفعل،+الرجاء+الانتظار#premium');
    }
    const proofUrl = `/uploads/payment-proofs/${req.file.filename}`;
    const note = (req.body.reference_note || '').slice(0, 300);
    db.prepare(
      'INSERT INTO premium_requests (user_id, proof_url, reference_note) VALUES (?, ?, ?)'
    ).run(req.session.userId, proofUrl, note);
    res.redirect('/dashboard?msg=تم+إرسال+طلبك+✅+راح+تتفعّل+خلال+وقت+قصير+بعد+المراجعة#premium');
  });
});

module.exports = router;
