require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const rateLimiter = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { seedSampleData } = require('./services/seeder');

// Route Imports
const authRoutes = require('./routes/auth');
const vocabRoutes = require('./routes/vocab');
const quizRoutes = require('./routes/quiz');
const feedbackRoutes = require('./routes/feedback');
const dashboardRoutes = require('./routes/dashboard');
const apiRoutes = require('./routes/api');


const app = express();


// Middleware Setup
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(expressLayouts);
app.set('layout', 'layouts/main'); 
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// CORS Configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.APP_DOMAIN);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

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
app.use('/vocab', vocabRoutes);
app.use('/quiz', quizRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/api', apiRoutes);
// Error Handler
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`SAT Study Buddy running on http://localhost:${PORT}`);
  try {
    await seedSampleData();
    console.log('Sample data seeded successfully');
  } catch (err) {
    console.log('Seed skipped or already done:', err.message);
  }
});