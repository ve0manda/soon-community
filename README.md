# $oon.lol — منصة بروفايلات شخصية (مثل guns.lol)

مشروع Node.js كامل: تسجيل حسابات (بالإيميل أو عبر Discord)، صفحة بروفايل عامة لكل مستخدم، تخصيص كامل (خلفية/موسيقى/ألوان/تأثيرات)، نظام Premium وBadges ولوحة إدارة، ودعم دومينات فرعية.

## المزايا
- 🔐 تسجيل / دخول (بالإيميل + bcrypt، أو عبر Discord OAuth2)
- 👤 صفحة عامة لكل مستخدم على `/u/username`
- 🎨 تخصيص: صورة شخصية، خلفية (لون/صورة/فيديو)، موسيقى خلفية، ألوان
- ✨ تأثيرات: جسيمات متحركة، ثلج، ماتريكس، توهج المؤشر، كتابة متحركة للبايو
- 🔗 روابط (Discord, Twitter...) بترتيب قابل للتعديل
- 👁 عداد زيارات لكل صفحة
- ⭐ نظام Premium/مجاني مع لوحة أدمن للترقية اليدوية
- 🏅 Badges تلقائية: Premium، OG (عضو مبكر)، موثّق، Discord، الإدارة
- 🎮 دخول/ربط حساب عبر Discord
- 🛡️ لوحة إدارة (`/admin`) لإدارة كل المستخدمين
- 🌐 دعم دومينات فرعية حقيقية (username.yoursite.com)
- 💾 قاعدة بيانات SQLite (ملف واحد — لا تحتاج سيرفر قاعدة بيانات منفصل)

## التشغيل محلياً

```bash
npm install
cp .env.example .env
npm start
```

افتح `http://localhost:3000`

## تصير أدمن على حسابك

في ملف `.env`، ضيف اسم المستخدم (username) تبعك بمتغير `ADMIN_USERNAMES`:

```
ADMIN_USERNAMES=your_username
```

سجل دخول (أو أعد تسجيل الدخول) وبيصير عندك زر "🛡️ الإدارة" فوق بلوحة التحكم، ويوصلك على `/admin` حيث تقدر:
- ترقّي/تلغي Premium لأي حساب
- توثّق/تلغي التوثيق لأي حساب
- تعطي/تشيل صلاحية أدمن لحسابات ثانية

> ملاحظة: نظام الدفع حالياً يدوي بالكامل (ما فيه Stripe أو بوابة دفع) — الترقية تصير من لوحة الأدمن فقط. لو حبيت تضيف دفع حقيقي لاحقاً (Stripe مثلاً)، بس قولي وأربطه بنفس حقل `is_premium` بقاعدة البيانات.

## نظام الـ Badges (تلقائي بالكامل)

الشارات تُحسب تلقائياً حسب حالة الحساب (ملف `utils/badges.js`)، ما تحتاج تسويها يدوي:

| الشارة | الشرط |
|---|---|
| ⭐ Premium | الحساب مرقّى لـ Premium من لوحة الأدمن |
| 💎 OG | أول 50 مستخدم سجلوا بالموقع (حسب رقم الحساب) |
| ✅ موثّق | الأدمن فعّل التوثيق له من لوحة `/admin` |
| 🎮 Discord | الحساب مربوط بـ Discord |
| 🔵 Google | الحساب مربوط بـ Google |
| 🛡️ الإدارة | الحساب أدمن |

لو حبيت تغيّر عدد أعضاء الـ OG، عدّل `OG_MAX_ID` في `utils/badges.js`.

## مزايا Premium مقابل المجاني

| | مجاني | Premium |
|---|---|---|
| عدد الروابط | 5 كحد أقصى | غير محدود |
| الصورة الشخصية | صورة فقط | صورة أو **فيديو متحرك** |
| خلفية الصفحة | لون أو صورة | لون / صورة / **فيديو** |
| تأثير المؤشر | عادي | + توهج (Glow) |
| شارة Premium | ❌ | ⭐ |

## تفعيل الدخول عبر Discord

1. روح لـ [Discord Developer Portal](https://discord.com/developers/applications) واعمل **New Application**.
2. من تبويب **OAuth2 → General**:
   - انسخ **Client ID** و **Client Secret**
   - بقسم **Redirects** ضيف بالضبط:
     ```
     http://localhost:3000/auth/discord/callback
     ```
     (وبعد النشر الفعلي ضيف كمان `https://yoursite.com/auth/discord/callback`)
3. في ملف `.env`:
   ```
   DISCORD_CLIENT_ID=...
   DISCORD_CLIENT_SECRET=...
   DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback
   ```
4. أعد تشغيل السيرفر. زر "🎮 دخول عبر Discord" بصفحة تسجيل الدخول بيصير شغال.

**كيف يشتغل:**
- مستخدم جديد يدخل عبر Discord لأول مرة → يتسوّى له حساب تلقائياً (اسم مستخدم مبني على يوزره بديسكورد، مع رقم إذا كان مكرر).
- مستخدم عنده حساب موجود ومسجل دخول ويضغط "ربط الحساب" من لوحة التحكم → يربط Discord لحسابه الحالي (يحصل شارة 🎮).
- الحسابات المنشأة عبر Discord فقط (بدون كلمة مرور) ما تقدر تفك ربط Discord — لأنه هو الطريقة الوحيدة لدخولها.

## تفعيل الدخول عبر Google

1. روح لـ [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. أنشئ مشروع جديد (أو استخدم موجود)، وروح لـ **APIs & Services → Credentials**
3. اضغط **Create Credentials → OAuth client ID**
   - إذا طلب منك تعبي **OAuth consent screen** أول مرة: اختر **External**، عبي اسم التطبيق وإيميلك، واحفظ (ما تحتاج تفعّل نشر/Verification للتجربة الشخصية — خله بوضع Testing وضيف إيميلك كـ Test User)
4. باختيار نوع التطبيق اختر **Web application**
5. تحت **Authorized redirect URIs** ضيف بالضبط:
   ```
   http://localhost:3000/auth/google/callback
   ```
   (وبعد النشر الفعلي ضيف كمان `https://yoursite.com/auth/google/callback`)
6. بعد الإنشاء، بيعطيك **Client ID** و **Client Secret** — انسخهم لملف `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
   ```
7. أعد تشغيل السيرفر. زر "🔵 دخول عبر Google" بصفحة تسجيل الدخول بيصير شغال.

يشتغل بنفس منطق Discord بالضبط: حساب جديد يتسوى تلقائياً، أو يرتبط بحسابك الحالي لو ضغطت "ربط الحساب" وانت مسجل دخول أصلاً.

## رفع المشروع لسيرفر خاص (VPS)

1. ارفع مجلد المشروع بالكامل للسيرفر (عدا `node_modules` و`.env`).
2. على السيرفر:
   ```bash
   npm install --production
   cp .env.example .env
   nano .env   # عدّل SESSION_SECRET، BASE_DOMAIN، ADMIN_USERNAMES، ومتغيرات Discord
   ```
3. استخدم مدير عمليات مثل PM2 عشان يفضل الموقع شغال:
   ```bash
   npm install -g pm2
   pm2 start server.js --name biolink
   pm2 save
   pm2 startup
   ```
4. ضع Nginx كـ reverse proxy قدام Node (مهم للـ SSL والدومينات الفرعية):
   ```nginx
   server {
       listen 80;
       server_name yoursite.com *.yoursite.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```
5. فعّل SSL بشهادة wildcard (تغطي كل الدومينات الفرعية):
   ```bash
   sudo certbot certonly --manual --preferred-challenges=dns -d yoursite.com -d *.yoursite.com
   ```
   (تحتاج DNS provider يدعم TXT records، مثل Cloudflare — الأسهل تستخدم `certbot-dns-cloudflare` بدل الطريقة اليدوية)
6. لا تنسَ تحدّث `DISCORD_REDIRECT_URI` بالـ `.env` وبإعدادات تطبيق Discord نفسه ليصير `https://yoursite.com/auth/discord/callback` بدل localhost.

## تفعيل الدومينات الفرعية (username.yoursite.com)

1. في DNS الخاص بدومينك، ضيف سجل:
   ```
   Type: A (أو CNAME)
   Name: *
   Value: [IP السيرفر تبعك]
   ```
   هذا يخلي أي `شي.yoursite.com` يوصل لسيرفرك.

2. في ملف `.env`:
   ```
   BASE_DOMAIN=yoursite.com
   ENABLE_SUBDOMAINS=true
   ```

3. أعد تشغيل السيرفر (`pm2 restart biolink`). الآن `mahmoud.yoursite.com` بيعرض صفحة المستخدم `mahmoud` تلقائياً، وبرضو تفضل صفحة `/u/mahmoud` شغالة كخيار احتياطي.

## هيكل المشروع

```
server.js              نقطة الدخول الرئيسية
db/database.js         تعريف قاعدة البيانات والجداول + migrations
utils/badges.js         منطق حساب الشارات التلقائية وحد الروابط المجاني
middleware/auth.js      requireAuth / requireAdmin / redirectIfAuth
routes/auth.js          تسجيل / دخول / خروج (إيميل)
routes/discord.js       دخول / ربط الحساب عبر Discord OAuth2
routes/admin.js         لوحة الإدارة (ترقية Premium/توثيق/أدمن)
routes/dashboard.js     لوحة التحكم + رفع الملفات + إدارة الروابط
routes/profile.js       عرض الصفحة العامة + كشف الدومين الفرعي
views/*.ejs             كل صفحات الموقع (server-rendered)
public/css/style.css    التصميم الكامل
public/js/profile-effects.js   تأثيرات الجسيمات/الثلج/الماتريكس/المؤشر
uploads/                ملفات المستخدمين المرفوعة (صور، فيديو، صوت)
```

## ملاحظات أمنية قبل النشر الفعلي
- غيّر `SESSION_SECRET` في `.env` لقيمة عشوائية طويلة.
- في `server.js`، فعّل `cookie: { secure: true }` في إعداد الجلسة بعد ما يكون عندك HTTPS.
- فكّر تحط حد أقصى لعدد المستخدمين أو نظام تحقق بريد إلكتروني (email verification) إذا الموقع رح يكون عام.
- إعداد الجلسات الحالي (MemoryStore) مناسب للتطوير أو سيرفر واحد بسيط؛ لو رح تشغل أكثر من نسخة (instance) من السيرفر بنفس الوقت، استبدله بـ store خارجي مثل Redis.
- لا تشارك `DISCORD_CLIENT_SECRET` أبداً، وحطه فقط بملف `.env` (المستثنى من git عبر `.gitignore`).
