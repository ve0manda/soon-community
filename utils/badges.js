const OG_MAX_ID = 50; // أول 50 حساب مسجل بالموقع يعتبرون أعضاء مبكرين (OG) — إلا لو الأدمن غيّر يدوياً

/**
 * يرجع مصفوفة الشارات (badges) المستحقة لهذا المستخدم بناءً على حالة حسابه.
 * كل شارة: { key, label, icon, color }
 * الأدمن يقدر يتحكم يدوياً بشارة OG والعضوية (member) عبر لوحة /admin
 * أما Premium/موثّق/أدمن فمتحكم فيها من نفس اللوحة أصلاً بأعمدة is_premium/is_verified/is_admin
 */
function getBadges(user) {
  const badges = [];

  if (user.is_premium) {
    badges.push({ key: 'premium', label: 'Premium', icon: '⭐', color: '#fbbf24' });
  }

  // OG: تلقائي (أول 50 حساب) إلا لو الأدمن فرض قيمة يدوية (1 = فرض تفعيل، 0 = فرض إلغاء، NULL = تلقائي)
  const isOg = user.og_override === 1 ? true : user.og_override === 0 ? false : user.id <= OG_MAX_ID;
  if (isOg) {
    badges.push({ key: 'og', label: 'OG', icon: '💎', color: '#e0475c' });
  }

  if (user.is_member) {
    badges.push({ key: 'member', label: 'عضو', icon: '👤', color: '#9ca3af' });
  }
  if (user.is_verified) {
    badges.push({ key: 'verified', label: 'موثّق', icon: '✅', color: '#34d399' });
  }
  if (user.discord_id) {
    badges.push({ key: 'discord', label: 'Discord', icon: '🎮', color: '#5865F2' });
  }
  if (user.google_id) {
    badges.push({ key: 'google', label: 'Google', icon: '🔵', color: '#4285F4' });
  }
  if (user.is_admin) {
    badges.push({ key: 'admin', label: 'الإدارة', icon: '🛡️', color: '#f87171' });
  }

  return badges;
}

// الحد الأقصى لعدد الروابط للحسابات المجانية (Premium = غير محدود)
const FREE_LINKS_LIMIT = 5;

// خيارات الشارة الزاوية (corner badge) الجاهزة يختار منها المستخدم
const CORNER_BADGE_OPTIONS = ['', '🔥', '👑', '💀', '🦇', '⚡', '🌙', '🎃', '❄️', '💯'];

module.exports = { getBadges, OG_MAX_ID, FREE_LINKS_LIMIT, CORNER_BADGE_OPTIONS };
