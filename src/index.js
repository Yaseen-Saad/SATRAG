require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const rateLimiter = require('./middleware/rateLimiter');
const { getStats } = require('./services/statsEngine');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const vocabRoutes = require('./routes/vocab');
const feedbackRoutes = require('./routes/feedback');
const dashboardRoutes = require('./routes/dashboard');
const practiceRoutes = require('./routes/practice');
const settingsRoutes = require('./routes/settings');
const flashcardsRoutes = require('./routes/flashcards');
const ticketsRoutes = require('./routes/ticket');
const statsRoutes = require('./routes/stats');
const { requireAuth, optionalAuth } = require('./middleware/auth');
const { requireProfileComplete } = require('./middleware/profile');
const { statfs } = require('fs/promises');

const app = express();

app.use(cookieParser());
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: process.env.APP_DOMAIN, credentials: true }));
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: false }));
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(rateLimiter());

app.get('/', optionalAuth, async (req, res) => {
  try {
    const stats = await getStats();
    res.render("index", { pageClass: 'landing', user: req.user || null, stats })
  } catch (error) {
    console.error('Home page error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.use('/auth', authRoutes);

app.use((req, res, next) => {
  const skip = ['/auth', '/settings', '/css', '/js']
  if (skip.some(path => req.path.startsWith(path))) {
    return next();
  }
  requireProfileComplete(req, res, next);
});

app.use('/vocab', vocabRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/practice', practiceRoutes);
app.use('/flashcards', flashcardsRoutes)
app.use('/settings', settingsRoutes);
app.use('/tickets', ticketsRoutes);
app.use('/stats', statsRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.error(`SAT Study Buddy running on http://localhost:${PORT}`));
}
module.exports = app;