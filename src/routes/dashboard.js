const { Router } = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const dashboardEngine = require('../services/dashboardEngine');
const vocabEngine = require('../services/vocabEngine')
const flashcardEngine = require('../services/flashcardsEngine')
const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      overview,
      practiceStats,
      topicBreakdown,
      weeklyActivity,
      streak,
      recentFeedback,
      dailyWord, vocabStats,
      flashcardStats
    ] = await Promise.all([
      dashboardEngine.getUserDashboardData(userId),
      dashboardEngine.getPracticeStats(userId),
      dashboardEngine.getTopicBreakdown(userId),
      dashboardEngine.getWeeklyActivity(userId),
      dashboardEngine.getStreak(userId),
      dashboardEngine.getRecentFeedback(userId),
      vocabEngine.getDailyWord(),
      vocabEngine.getVocabStats(userId),
      flashcardEngine.getStats(userId)
    ]);

    const weakestTopics = topicBreakdown.slice(0, 5);

    res.render('dashboard/progress', {
      user: req.user,
      ...overview,
      practiceStats,
      topicBreakdown,
      weakestTopics,
      weeklyActivity,
      streak,
      recentFeedback,
      dailyWord,
      vocabStats,
      flashcardStats
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.redirect('/');
  }
});

router.get('/leaderboard', optionalAuth, async (req, res) => {
  try {

    const { page = 1, limit = 50 } = req.query;
    const result = await dashboardEngine.getLeaderboard({
      limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit),
      userId: req.user?.id
    })
    res.render('dashboard/leaderboard', { user: req.user, entries: result.entries || [], totalCount: result.totalCount || 0, userRank: result.userRank, page: parseInt(page), limit: parseInt(limit), error: null });
  } catch (Err) {
    res.render('dashboard/leaderboard', { user: req.user, entries: [], totalCount: 0, userRank: null, page: 1, limit: 50, error: Err.message })
  }
})

router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const [sessions, trend, timeANalytics] = await Promise.all([
      dashboardEngine.getSessionAnalytics(req.user.id),
      dashboardEngine.getPerformanceTrend(req.user.id),
      dashboardEngine.getTimeAnalytics(req.user.id)
    ])
    res.render('dashboard/analytics', { user: req.user, sessions, trend, timeAnalytics: timeANalytics, error: null });
  } catch (error) {
    res.render('dashboard/analytics', { user: req.user, sessions: [], trend: [], timeAnalytics: [], error: error.message });
  }
})
module.exports = router;