const OG_MAX_ID = 50; // أول 50 حساب مسجل بالموقع يعتبرون أعضاء مبكرين (OG)

/**
 * يرجع مصفوفة الشارات (badges) المستحقة لهذا المستخدم بناءً على حالة حسابه.
 * كل شارة: { key, label, icon, color }
 */
function getBadges(user) {
  const badges = [];

  if (user.is_premium) {
    badges.push({ key: 'premium', label: 'Premium', icon: '⭐', color: '#fbbf24' });
  }
  if (user.id <= OG_MAX_ID) {
    badges.push({ key: 'og', label: 'OG', icon: '💎', color: '#22d3ee' });
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

module.exports = { getBadges, OG_MAX_ID, FREE_LINKS_LIMIT };
