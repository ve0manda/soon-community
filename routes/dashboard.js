const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { getBadges, FREE_LINKS_LIMIT, CORNER_BADGE_OPTIONS } = require('../utils/badges');

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

// معرض خلفيات جاهزة (بريسيتس) يختار منها المستخدم بدل الرفع
const PRESET_BACKGROUNDS = [
  { id: 'crimson-fog', label: 'ضباب قرمزي', url: '/public/img/presets/crimson-fog.svg' },
  { id: 'midnight', label: 'منتصف الليل', url: '/public/img/presets/midnight.svg' },
  { id: 'blood-moon', label: 'قمر دموي', url: '/public/img/presets/blood-moon.svg' },
  { id: 'void', label: 'العدم', url: '/public/img/presets/void.svg' }
];

router.get('/dashboard', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  const links = db.prepare('SELECT * FROM links WHERE user_id = ? ORDER BY sort_order ASC, id ASC').all(user.id);
  res.render('dashboard', {
    user,
    links,
    badges: getBadges(user),
    linksLimit: user.is_premium ? null : FREE_LINKS_LIMIT,
    cornerBadgeOptions: CORNER_BADGE_OPTIONS,
    presetBackgrounds: PRESET_BACKGROUNDS,
    message: req.query.msg || null
  });
});

router.post('/dashboard/profile', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  let {
    display_name, bio, bg_color, accent_color, text_color, effect, cursor_effect, background_type,
    card_color, card_opacity, corner_badge, rgb_border
  } = req.body;

  // تأثير المؤشر (glow) ميزة Premium فقط
  if (cursor_effect === 'glow' && !user.is_premium) {
    cursor_effect = 'none';
  }
  // خلفية الفيديو ميزة Premium فقط — إذا الحساب مجاني وما عنده فيديو مرفوع مسبقاً، رجعه صورة/لون
  if (background_type === 'video' && !user.is_premium) {
    background_type = user.background_type === 'video' ? 'color' : background_type;
  }
  // إطار RGB متحرك حول البطاقة — Premium فقط
  const rgbBorderVal = (rgb_border === 'on' && user.is_premium) ? 1 : 0;

  const opacity = Math.max(0, Math.min(100, parseInt(card_opacity, 10) || 82));

  db.prepare(`UPDATE users SET display_name = ?, bio = ?, bg_color = ?, accent_color = ?, text_color = ?,
              effect = ?, cursor_effect = ?, background_type = ?, card_color = ?, card_opacity = ?,
              corner_badge = ?, rgb_border = ? WHERE id = ?`)
    .run(display_name, bio, bg_color, accent_color, text_color, effect, cursor_effect, background_type,
         card_color, opacity, corner_badge || '', rgbBorderVal, req.session.userId);
  res.redirect('/dashboard?msg=تم حفظ التغييرات بنجاح');
});

router.post('/dashboard/avatar', requireAuth, avatarUpload.single('avatar'), (req, res) => {
  const user = db.prepare('SELECT is_premium FROM users WHERE id = ?').get(req.session.userId);
  if (req.file) {
    const isVideo = req.file.mimetype.startsWith('video');
    if (isVideo && !user.is_premium) {
      fs.unlinkSync(req.file.path);
      return res.redirect('/dashboard?msg=صورة+البروفايل+المتحركة+(فيديو)+متاحة+لحسابات+Premium+فقط');
    }
    const url = `/uploads/avatars/${req.file.filename}`;
    const type = isVideo ? 'video' : 'image';
    db.prepare("UPDATE users SET avatar_url = ?, avatar_type = ?, avatar_source = 'custom' WHERE id = ?")
      .run(url, type, req.session.userId);
  }
  res.redirect('/dashboard?msg=تم تحديث الصورة الشخصية');
});

// ----- اختيار مصدر الصورة الشخصية: مرفوعة يدوياً / من Discord / من Google -----
router.post('/dashboard/avatar/source', requireAuth, (req, res) => {
  const { source } = req.body; // 'custom' | 'discord' | 'google'
  if (!['custom', 'discord', 'google'].includes(source)) {
    return res.redirect('/dashboard');
  }
  db.prepare('UPDATE users SET avatar_source = ? WHERE id = ?').run(source, req.session.userId);
  res.redirect('/dashboard?msg=تم+تحديث+مصدر+الصورة+الشخصية');
});

router.post('/dashboard/background', requireAuth, backgroundUpload.single('background'), (req, res) => {
  const user = db.prepare('SELECT is_premium FROM users WHERE id = ?').get(req.session.userId);
  if (req.file) {
    const isVideo = req.file.mimetype.startsWith('video');
    if (isVideo && !user.is_premium) {
      fs.unlinkSync(req.file.path);
      return res.redirect('/dashboard?msg=خلفيات+الفيديو+متاحة+لحسابات+Premium+فقط');
    }
    const url = `/uploads/backgrounds/${req.file.filename}`;
    const type = isVideo ? 'video' : 'image';
    db.prepare('UPDATE users SET background_url = ?, background_type = ? WHERE id = ?')
      .run(url, type, req.session.userId);
  }
  res.redirect('/dashboard?msg=تم تحديث الخلفية');
});

// ----- اختيار خلفية جاهزة من المعرض -----
router.post('/dashboard/background/preset', requireAuth, (req, res) => {
  const preset = PRESET_BACKGROUNDS.find(p => p.id === req.body.preset_id);
  if (preset) {
    db.prepare("UPDATE users SET background_url = ?, background_type = 'image' WHERE id = ?")
      .run(preset.url, req.session.userId);
  }
  res.redirect('/dashboard?msg=تم+تطبيق+الخلفية+الجاهزة');
});

router.post('/dashboard/audio', requireAuth, audioUpload.single('audio'), (req, res) => {
  if (req.file) {
    const url = `/uploads/audio/${req.file.filename}`;
    db.prepare('UPDATE users SET audio_url = ? WHERE id = ?').run(url, req.session.userId);
  }
  res.redirect('/dashboard?msg=تم تحديث الموسيقى');
});

// ----- تعبئة عشوائية كاملة (زر "🎲 عشوائي") -----
router.post('/dashboard/randomize', requireAuth, (req, res) => {
  const colors = ['#a01c2c', '#e0475c', '#7c1d3f', '#2e1a47', '#0f5c4a', '#1c3a5e', '#8a5c0f', '#4a0f5c'];
  const effects = ['none', 'particles', 'snow', 'matrix'];
  const rand = arr => arr[Math.floor(Math.random() * arr.length)];
  db.prepare(`UPDATE users SET bg_color = ?, accent_color = ?, effect = ? WHERE id = ?`)
    .run('#0b0709', rand(colors), rand(effects), req.session.userId);
  res.redirect('/dashboard?msg=🎲+تم+تطبيق+تشكيلة+عشوائية');
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
  const user = db.prepare('SELECT password_hash, avatar_source FROM users WHERE id = ?').get(req.session.userId);
  if (!user.password_hash) {
    return res.redirect('/dashboard?msg=لا+يمكنك+فك+الربط+—+حسابك+ما+عنده+كلمة+مرور،+Discord+هو+الطريقة+الوحيدة+لدخولك');
  }
  const newSource = user.avatar_source === 'discord' ? 'custom' : user.avatar_source;
  db.prepare("UPDATE users SET discord_id = NULL, discord_username = '', discord_avatar = '', avatar_source = ? WHERE id = ?")
    .run(newSource, req.session.userId);
  res.redirect('/dashboard?msg=تم+فك+ربط+حساب+Discord');
});

router.post('/dashboard/google/unlink', requireAuth, (req, res) => {
  const user = db.prepare('SELECT password_hash, avatar_source FROM users WHERE id = ?').get(req.session.userId);
  if (!user.password_hash) {
    return res.redirect('/dashboard?msg=لا+يمكنك+فك+الربط+—+حسابك+ما+عنده+كلمة+مرور،+Google+هو+الطريقة+الوحيدة+لدخولك');
  }
  const newSource = user.avatar_source === 'google' ? 'custom' : user.avatar_source;
  db.prepare("UPDATE users SET google_id = NULL, google_email = '', google_avatar = '', avatar_source = ? WHERE id = ?")
    .run(newSource, req.session.userId);
  res.redirect('/dashboard?msg=تم+فك+ربط+حساب+Google');
});

module.exports = router;
