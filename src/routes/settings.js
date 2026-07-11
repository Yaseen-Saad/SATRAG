const { Router } = require('express');

const { requireAuth } = require('../middleware/auth');
const settingsEngine = require('../services/settingsEngine');
const supabase = require('../lib/supabase');

const router = Router()

router.get('/', requireAuth, async (req, res) => {
    const { data: profile } = await supabase.from('public_profiles').select('*').eq('id', req.user.id).single();
    res.render('settings/index', { user: req.user, profile, error: null, success: null, prompt: req.query.prompt })
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
    const enabled = req.body.leaderboardstatus === 'enabled';
    await settingsEngine.toggleParticipateInLeaderboard(req.user, enabled)
    res.redirect('/settings')
})

router.get('/avatar/:user', async (req, res) => {
    const enabled = req.body.leaderboardstatus === 'enabled';
    await settingsEngine.toggleParticipateInLeaderboard(req.user, enabled)
    res.redirect('/settings')
})
router.post('/avatar', requireAuth, async (req, res) => {
    const enabled = req.body.leaderboardstatus === 'enabled';
    await settingsEngine.toggleParticipateInLeaderboard(req.user, enabled)
    res.redirect('/settings')
})

module.exports = router;