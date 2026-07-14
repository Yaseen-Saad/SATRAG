const { Router } = require('express');
const multer = require('multer');
const path = require('path');

const { requireAuth } = require('../middleware/auth');
const { sanitize } = require('../lib/utils')
const settingsEngine = require('../services/settingsEngine');
const supabase = require('../lib/supabase');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    }
})

const router = Router()

const ALLOWED_GRADES = new Set(['9', '10', '11', '12', 'Gap Year', "Other", "I am not a student"])
const ALLOWED_GENDERS = new Set(['male', 'female'])
const ALLOWED_REFERALS = new Set(['friend', 'socialmedia', 'school', 'teacher', 'other'])

router.get('/', requireAuth, async (req, res) => {
    try {
        const { data: profile } = await supabase.from('public_profiles').select('id, first_name, last_name, school, grade, gender, birthdate, email, avatar_url, participate_in_leaderboard, monthly_gen_count, monthly_gen_month').eq('id', req.user.id).single();
        res.render('settings/index', { user: req.user, profile, error: null, success: null, prompt: req.query.prompt })
    } catch (err) {
        console.error('Settings page error:', err);
        res.redirect('/');
    }
})

router.post('/update-all', requireAuth, async (req, res) => {
    try {
        const errors = [];
        const updates = {};
        const firstName = sanitize(req.body.firstName);
        const lastName = sanitize(req.body.lastName);
        const grade = (req.body.grade || '').trim();
        const gender = (req.body.gender || '').trim();
        const school = sanitize(req.body.school);
        const birthdate = sanitize(req.body.birthdate);

        if (!firstName || firstName.length > 100) errors.push('First name is required (max 100 chars)');
        if (!lastName || lastName.length > 100) errors.push('Last name is required (max 100 chars)');
        if (!school || school.length > 200) errors.push('School is required (max 200 chars)');
        if (grade && !ALLOWED_GRADES.has(grade)) errors.push('Invalid grade');
        if (gender && !ALLOWED_GENDERS.has(gender)) errors.push('Invalid gender');
        if (birthdate && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) errors.push('Invalid date format');

        updates.first_name = firstName;
        updates.last_name = lastName;
        updates.school = school;
        if (grade) updates.grade = grade;
        if (gender) updates.gender = gender;
        if (birthdate) updates.birthdate = birthdate;

        const llmKey = req.body.llmKey ? sanitize(req.body.llmKey) : '';
        const embeddingKey = req.body.embeddingKey ? sanitize(req.body.embeddingKey) : '';
        if (llmKey && llmKey.length < 10) errors.push('LLM API key too short');
        if (embeddingKey && embeddingKey.length < 10) errors.push('Embedding API key too short');
        if (llmKey) updates.llm_apikey = llmKey;
        if (embeddingKey) updates.embedding_apikey = embeddingKey;

        const leaderboardEnabled = req.body.leaderboardstatus === 'enabled';
        const referral = (req.body.referral || '').trim();
        if (referral && !ALLOWED_REFERALS.has(referral)) errors.push('Invalid referral source');
        updates.participate_in_leaderboard = leaderboardEnabled;
        if (referral) updates.referral = referral;

        if (errors.length > 0) {
            return res.redirect('/settings?error=' + encodeURIComponent(errors.join('; ')));
        }

        await settingsEngine.updateAll(req.user, updates);
        res.redirect('/settings?success=All settings saved');
    } catch (err) {
        console.error('Update all error:', err);
        res.redirect('/settings?error=' + encodeURIComponent(err.message || 'Update failed'));
    }
})

router.post('/avatar/upload', requireAuth, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.redirect('/settings?error=No file selected');
        const ext = path.extname(req.file.originalname).toLowerCase();
        const filename = `${req.user.id}/${Date.now()}${ext}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filename, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: true
        });
        if (uploadError) throw new Error(uploadError.message);
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filename);
        await supabase.from('public_profiles').update({ avatar_url: publicUrl }).eq('id', req.user.id);
        res.redirect('/settings?success=Avatar uploaded');
    } catch (err) {
        console.error('Avatar upload error:', err);
        res.redirect('/settings?error=' + encodeURIComponent(err.message));
    }
})

router.get('/avatar/:user', requireAuth, async (req, res) => {
    const { data: profile } = await supabase.from('public_profiles').select('avatar_url').eq('id', req.params.user).single();
    if (!profile) return res.status(404).send('Not found');
    if (profile.avatar_url) return res.redirect(profile.avatar_url);
    res.status(404).send('No avatar');
})

module.exports = router;