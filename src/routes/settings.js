const { Router } = require('express');
const multer = require('multer');
const path = require('path');

const { requireAuth } = require('../middleware/auth');
const { sanitize } = require('../lib/utils')
const settingsEngine = require('../services/settingsEngine');
const supabase = require('../lib/supabase').service;

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

const ALLOWED_GRADES = new Set(['9', '10', '11', '12', 'Gap Year', "I am not a student"])
const ALLOWED_GENDERS = new Set(['male', 'female'])

const PROFILE_COLUMNS = 'id, first_name, last_name, school, email, gender, birthdate, avatar_url, participate_in_leaderboard, referral, first_login, last_login, grade';

router.get('/', requireAuth, async (req, res) => {
    try {
        const { data: profile } = await supabase.from('public_profiles').select(PROFILE_COLUMNS).eq('id', req.user.id).single();
        res.render('settings/index', { user: req.user, profile: profile || {}, error: null, success: null, prompt: req.query.prompt })
    } catch (err) {
        console.error('Settings page error:', err.message);
        res.render('settings/index', { user: req.user, profile: {}, error: null, success: null, prompt: req.query.prompt })
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
        updates.grade = grade || null;
        updates.gender = gender || null;
        updates.birthdate = birthdate || null;

        const llmKey = req.body.llmKey ? req.body.llmKey.trim() : '';
        const embeddingKey = req.body.embeddingKey ? req.body.embeddingKey.trim() : '';
        if (llmKey && llmKey.length < 10) errors.push('LLM API key too short');
        if (embeddingKey && embeddingKey.length < 10) errors.push('Embedding API key too short');
        if (llmKey) updates.llm_apikey = llmKey;
        if (embeddingKey) updates.embedding_apikey = embeddingKey;

        const avatarUrl = (req.body.avatarUrl || '').trim();
        if (avatarUrl && /^https?:\/\//.test(avatarUrl)) updates.avatar_url = avatarUrl;

        const leaderboardEnabled = req.body.leaderboardstatus === 'enabled';
        updates.participate_in_leaderboard = leaderboardEnabled;

        if (errors.length > 0) {
            return res.status(400).redirect('/settings/index', { user: req.user, profile: updates, error: errors.join('; '), success: null, prompt: null });
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
        if (!req.file) return res.status(400).json({ error: 'No file selected' });
        const ext = path.extname(req.file.originalname).toLowerCase();
        const filename = `${req.user.id}/${Date.now()}${ext}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filename, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: true
        });
        if (uploadError) throw new Error(uploadError.message);
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filename);
        const { error: updateErr } = await supabase.from('public_profiles').update({ avatar_url: publicUrl }).eq('id', req.user.id);
        if (updateErr) throw updateErr;
        res.json({ url: publicUrl });
    } catch (err) {
        console.error('Avatar upload error:', err);
        res.status(500).json({ error: err.message });
    }
})

router.get('/avatar/:user', requireAuth, async (req, res) => {
    const { data: profile } = await supabase.from('public_profiles').select('avatar_url').eq('id', req.params.user).single();
    if (!profile) return res.status(404).send('Not found');
    if (profile.avatar_url && /^https?:\/\//.test(profile.avatar_url)) return res.redirect(profile.avatar_url);
    res.status(404).send('No avatar');
})

module.exports = router;
