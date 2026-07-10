require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const rateLimiter = require('./middleware/rateLimiter');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// Route Imports
const authRoutes = require('./routes/auth');
const vocabRoutes = require('./routes/vocab');
const feedbackRoutes = require('./routes/feedback');
const dashboardRoutes = require('./routes/dashboard');
const practiceRoutes = require('./routes/practice');
const settingsRoutes = require('./routes/settings');
const { requireProfileComplete } = require('./middleware/profile');

const app = express();

// Middleware Setup
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({ origin: process.env.APP_DOMAIN, credentials: true }));
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiter
app.use(rateLimiter());

// Welcome Page
app.get('/', async (req, res) => {
  try {
    res.render("index")
  } catch (error) {
    console.log(error);
  }
});

app.use('/auth', authRoutes);

app.use((req, res, next) => {
  const skip = ['/auth', '/settings', '/css', '/js', '/']
  if (skip.some(path => req.path.startsWith(path))) {
    return next();
  }
  requireProfileComplete(req, res, next);
});

app.use('/vocab', vocabRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/practice', practiceRoutes);
app.use('/settings', settingsRoutes);

// Error Handler
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`SAT Study Buddy running on http://localhost:${PORT}`);
});