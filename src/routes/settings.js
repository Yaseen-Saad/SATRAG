const { Router } = require('express');

const { requireAuth } = require('../middleware/auth');
const settingsEngine = require('../services/settingsEngine');
const supabase = require('../lib/supabase');

const router = Router()

router.get('/', requireAuth, async (req, res) => {
    try {
        const { data: profile } = await supabase.from('public_profiles').select('*').eq('id', req.user.id).single();
        res.render('settings/index', { user: req.user, profile, error: null, success: null, prompt: req.query.prompt })
    } catch (err) {
        console.error('Settings page error:', err);
        res.redirect('/');
    }
})

router.post('/changeFName', requireAuth, async (req, res) => {
    try {
        await settingsEngine.changeFirstName(req.user, req.body.firstName)
        await settingsEngine.changeLastName(req.user, req.body.lastName)
        res.redirect('/settings?success=Name updated')
    } catch (err) { console.error('Name update error:', err); res.redirect('/settings?error=' + encodeURIComponent(err.message || 'Name update failed')) }
})
router.post('/changeLName', requireAuth, async (req, res) => {
    try { await settingsEngine.changeLastName(req.user, req.body.lastName); res.redirect('/settings?success=Last name updated') } catch (err) { console.error('Last name error:', err); res.redirect('/settings?error=' + encodeURIComponent(err.message || 'Update failed')) }
})
router.post('/changeGrade', requireAuth, async (req, res) => {
    try { await settingsEngine.changeGradeLevel(req.user, req.body.grade); res.redirect('/settings?success=Grade updated') } catch (err) { console.error('Grade error:', err); res.redirect('/settings?error=' + encodeURIComponent(err.message || 'Update failed')) }
})
router.post('/changeLLMkey', requireAuth, async (req, res) => {
    try { await settingsEngine.updateLLMAPIKey(req.user, req.body.llmKey); res.redirect('/settings?success=LLM API key updated') } catch (err) { console.error('LLM key error:', err); res.redirect('/settings?error=' + encodeURIComponent(err.message || 'Update failed')) }
})
router.post('/changeEmbeddingkey', requireAuth, async (req, res) => {
    try { await settingsEngine.updateEmbeddingsAPIKey(req.user, req.body.embeddingKey); res.redirect('/settings?success=Embedding API key updated') } catch (err) { console.error('Embedding key error:', err); res.redirect('/settings?error=' + encodeURIComponent(err.message || 'Update failed')) }
})
router.post('/changeLeaderboardStatus', requireAuth, async (req, res) => {
    try {
        const enabled = req.body.leaderboardstatus === 'enabled';
        await settingsEngine.toggleParticipateInLeaderboard(req.user, enabled);
        res.redirect('/settings?success=Leaderboard preference updated')
    } catch (err) { console.error('Leaderboard toggle error:', err); res.redirect('/settings?error=' + encodeURIComponent(err.message || 'Update failed')) }
})

router.get('/avatar/:user', requireAuth, async (req, res) => {
    const { data: profile } = await supabase.from('public_profiles').select('avatar_url').eq('id', req.params.user).single();
    if (!profile) return res.status(404).send('Not found');
    res.redirect(profile.avatar_url);
})
router.post('/avatar', requireAuth, async (req, res) => {
    try {
        const url = req.body.avatarUrl;
        if (!url) return res.redirect('/settings?error=No URL provided');
        await supabase.from('public_profiles').update({ avatar_url: url }).eq('id', req.user.id);
        res.redirect('/settings?success=Avatar updated');
    } catch (err) {
        console.error('Avatar update error:', err);
        res.redirect('/settings?error=' + encodeURIComponent(err.message || 'Update failed'));
    }
})

module.exports = router;