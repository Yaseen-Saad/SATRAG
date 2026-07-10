const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const settingsEngine = require('../services/settingsEngine');

const router = Router()

router.get('/', requireAuth, async (req, res) => {
    res.render('settings/index', { user: req.user, error: null, success: null })
})

router.post('/changeFName', requireAuth, async (req, res) => {
    await settingsEngine.changeFirstName(req.user, req.body.firstName)
    res.redirect('/settings')
})
router.post('/changeLName', requireAuth, async (req, res) => {
    await settingsEngine.changeLastName(req.user, req.body.lastName)
    res.redirect('/settings')
})
router.post('/changeGrade', requireAuth, async (req, res) => {
    await settingsEngine.changeGradeLevel(req.user, req.body.grade)
    res.redirect('/settings')
})
router.post('/changeLLMkey', requireAuth, async (req, res) => {
    await settingsEngine.updateLLMAPIKey(req.user, req.body.llmKey)
    res.redirect('/settings')
})
router.post('/changeEmbeddingkey', requireAuth, async (req, res) => {
    await settingsEngine.updateEmbeddingsAPIKey(req.user, req.body.embeddingKey)
    res.redirect('/settings')
})
router.post('/changeLeaderboardStatus', requireAuth, async (req, res) => {
    await settingsEngine.toggleParticipateInLeaderboard(req.user, req.body.leaderboardStatus)
    res.redirect('/settings')
})

module.exports = router;