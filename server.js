require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const discordRoutes = require('./routes/discord');
const googleRoutes = require('./routes/google');
const adminRoutes = require('./routes/admin');
const { router: profileRoutes, renderProfile } = require('./routes/profile');
const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'localhost';
const ENABLE_SUBDOMAINS = process.env.ENABLE_SUBDOMAINS === 'true';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 يوم
}));

// ----- Subdomain detection middleware -----
// إذا كان ENABLE_SUBDOMAINS=true وطلب المستخدم mahmoud.example.com يُعرض بروفايله مباشرة
app.use((req, res, next) => {
  if (!ENABLE_SUBDOMAINS) return next();
  const host = req.hostname; // e.g. mahmoud.example.com
  if (host === BASE_DOMAIN || host === `www.${BASE_DOMAIN}`) return next();
  const sub = host.replace(`.${BASE_DOMAIN}`, '');
  if (sub && sub !== host) {
    return renderProfile(req, res, sub);
  }
  next();
});

app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/', discordRoutes);
app.use('/', googleRoutes);
app.use('/', adminRoutes);
app.use('/', profileRoutes);

app.get('/', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  res.render('home', { totalUsers, loggedIn: !!req.session.userId });
});

app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, () => {
  console.log(`🚀 الموقع يعمل على http://localhost:${PORT}`);
});
