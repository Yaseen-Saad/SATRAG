const { Router } = require('express');

const { requireAuth } = require('../middleware/auth');
const settingsEngine = require('../services/settingsEngine');
const supabase = require('../lib/supabase');

const router = Router()

function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, "").trim();
}
const ALLOWED_GRADES = new Set(['9', '10', '11', '12', 'Gap Year', "Other", "I am not a student"])
const ALLOWED_GENDERS = new Set(['Male', 'Female'])
const ALLOWED_REFERALS = new Set(['Friend', 'Social Media', 'Search Engine', 'school', 'teacher', 'Other'])

router.get('/', requireAuth, async (req, res) => {
    try {
        const { data: profile } = await supabase.from('public_profiles').select('*').eq('id', req.user.id).single();
        res.render('settings/index', { user: req.user, profile, error: null, success: null, prompt: req.query.prompt })
    } catch (err) {
        console.error('Settings page error:', err);
        res.redirect('/');
    }
})

router.post('/update-all', requireAuth, async (req, res) => {
    try {
        const errors = {}
        const updates = {}
        const firstName = sanitize(req.body.firstName);
        const lastName = sanitize(req.body.lastName);
        const grade = sanitize(req.body.grade);
        const gender = sanitize(req.body.gender);
        const referral = sanitize(req.body.referral);
        const school = sanitize(req.body.school);
        const birthdte = sanitize(req.body.birthday);
        const avatar = sanitize(req.body.avatar);

        if (!firstName || firstName.length > 100) errors.push('First name is required (max 100 characters)');
        if (!lastName || lastName.length > 100) errors.push('Last name is required (max 100 characters)');
        if (grade && !ALLOWED_GRADES.has(grade)) errors.push('Invalid grade level');
        if (gender && !ALLOWED_GENDERS.has(gender)) errors.push('Invalid gender');
        if (referral && !ALLOWED_REFERALS.has(referral)) errors.push('Invalid referral source');
        if (school && school.length > 200) errors.push('School name is too long (max 200 characters)');
        if (birthdte && !/^\d{4}-\d{2}-\d{2}$/.test(birthdte)) errors.push('Invalid birthday format (expected YYYY-MM-DD)');
        if (avatar && !/^https?:\/\/.+\.(jpg|jpeg|png|gif)$/.test(avatar)) errors.push('Invalid avatar URL');

        if (errors.length > 0) throw new Error(errors.join('\n'));

        if (firstName) updates.first_name = firstName;
        if (lastName) updates.last_name = lastName;
        if (grade) updates.grade_level = grade;
        if (gender) updates.gender = gender;
        if (referral) updates.referral_source = referral;
        if (school) updates.school = school;
        if (birthdte) updates.birthday = birthdte;
        if (avatar) updates.avatar = avatar;

        const llmKey = req.body.llmKey ? sanitize(req.body.llmKey) : null;
        const embeddingKey = req.body.embeddingKey ? sanitize(req.body.embeddingKey) : null;
        if (llmKey && llmKey.length > 0 && llmKey.length < 10) throw new Error('LLM API key is too short');
        if (embeddingKey && embeddingKey.length > 0 && embeddingKey.length < 10) throw new Error('Embedding API key is too short');
        if (!llmKey.startsWith("sk-")) throw new Error('LLM API key must start with "sk-"');
        if (llmKey) updates.llm_api_key = llmKey;
        if (embeddingKey) updates.embedding_api_key = embeddingKey;
        const leaderboardEnabled = req.body.leaderboardstatus === 'enabled';
        const referral = req.body.referral ? sanitize(req.body.referral) : null;
        if (referral && !ALLOWED_REFERALS.has(referral)) throw new Error('Invalid referral source');
        if (referral) updates.referral_source = referral;
        if (leaderboardEnabled) updates.participate_in_leaderboard = true;
        else updates.participate_in_leaderboard = false;

        await settingsEngine.updateAll(req.user, updates);
        res.redirect('/settings?success=All updated');
    } catch (err) {
        console.error('Update all error:', err);
        res.redirect('/settings?error=' + encodeURIComponent(err.message || 'Update failed'));
    }
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