const { Router } = require('express')
const supabase = require('../lib/supabase')
const config = require('../config')
const { normalizeEmail } = require('../lib/utils')

const router = Router();

const disposableDomains = (() => {
    try {
        return require('disposable-email-domains');
    } catch {
        return [];
    }
})();

function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').trim();
}

function validatePassword(password) {
    const errors = [];
    if (!password || password.length < 8) errors.push('Password must be at least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
    if (!/[0-9]/.test(password)) errors.push('Password must contain a number');
    if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password must contain a special character');
    return errors;
}

router.get('/login', (req, res) => {
    res.render('auth/login', { error: null })
})

router.get('/signup', (req, res) => {
    res.render('auth/signup', { error: null })
})

router.post('/login', async (req, res) => {
    try {
        let { email, password } = req.body;
        email = normalizeEmail(sanitize(email));
        if (!email || !password) {
            return res.render('auth/login', { error: 'Email and password are required' })
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return res.render('auth/login', { error: error.message })
        const { error: loginErr } = await supabase.service.from('public_profiles').update({ last_login: new Date().toISOString() }).eq('id', data.user.id);
        if (loginErr) console.error('last_login update failed:', loginErr.message);
        const remember = req.body.remember === '1';
        res.cookie('sb_access_token', data.session.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: remember ? 30 * 24 * 60 * 60 * 1000 : undefined })
        res.redirect('/')
    } catch (err) {
        console.error('Login error:', err.message);
        res.render('auth/login', { error: 'An error occurred. Please try again.' })
    }
})

router.post('/signup', async (req, res) => {
    try {
        let { email, password, firstName, lastName, school, referral } = req.body;
        email = normalizeEmail(sanitize(email));
        firstName = sanitize(firstName);
        lastName = sanitize(lastName);
        school = sanitize(school);
        referral = (referral || '').trim();

        const ALLOWED_REFERALS = new Set(['friend', 'socialmedia', 'school', 'teacher', 'other']);
        if (!email || !password || !firstName || !lastName || !school || !referral) {
            return res.render('auth/signup', { error: 'All fields are required' })
        }
        if (!ALLOWED_REFERALS.has(referral)) {
            return res.render('auth/signup', { error: 'Invalid referral source' })
        }

        const pwErrors = validatePassword(password);
        if (pwErrors.length > 0) {
            return res.render('auth/signup', { error: pwErrors.join('; ') })
        }

        const domain = email.split('@')[1]?.toLowerCase();
        if (domain && disposableDomains.includes(domain)) {
            return res.render('auth/signup', { error: 'Disposable email addresses are not allowed. Please use a permanent email.' })
        }

        const { data: existing } = await supabase.service.from('public_profiles').select('id').eq('email', email).maybeSingle();
        if (existing) {
            return res.render('auth/signup', { error: 'An account with this email already exists.' })
        }

        const { data, error } = await supabase.auth.signUp({
            email, password, options: {
                data: { first_name: firstName, last_name: lastName, school }
            }
        })
        if (error) return res.render('auth/signup', { error: error.message })
        if (data.session) {
            const profileRow = {
                id: data.user.id,
                first_name: firstName, last_name: lastName, school, email, referral,
                participate_in_leaderboard: true,
                first_login: new Date().toISOString(),
                last_login: new Date().toISOString()
            }
            const { error: profileErr } = await supabase.service.from('public_profiles').upsert(profileRow, { onConflict: 'id' })
            if (profileErr) console.error('Profile creation failed:', profileErr.message)
            res.cookie('sb_access_token', data.session.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 86400000 })
            return res.redirect('/settings')
        }
        res.render('auth/login', { error: "Signup successful! Check your email to confirm, then log in." })
    } catch (err) {
        console.error('Signup error:', err.message);
        res.render('auth/signup', { error: 'An error occurred. Please try again.' })
    }
})

router.get('/logout', (req, res) => {
    res.clearCookie('sb_access_token');
    res.redirect('/auth/login');
})

router.get("/forgot-password", (req, res) => {
    res.render('auth/forgot-password', { error: null, success: null })
})

router.post("/forgot-password", async (req, res) => {
    try {
        let { email } = req.body;
        email = normalizeEmail(sanitize(email));
        if (!email) return res.render("auth/forgot-password", { error: "Please provide an email", success: null })

        const domain = email.split('@')[1]?.toLowerCase();
        if (domain && disposableDomains.includes(domain)) {
            return res.render('auth/forgot-password', { error: 'Disposable email addresses are not allowed.', success: null })
        }

        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${config.APP_DOMAIN}/auth/reset-password?email=${encodeURIComponent(email)}`,
        })
        if (error) return res.render('auth/forgot-password', { error: error.message, success: null })
        res.render('auth/forgot-password', { error: null, success: "Password reset email sent" })
    } catch (err) {
        console.error('Forgot password error:', err.message);
        res.render('auth/forgot-password', { error: 'An error occurred. Please try again.', success: null })
    }
})

router.get('/reset-password', (req, res) => {
    res.render('auth/reset-password', { error: null, success: null })
})

router.post('/reset-password', async (req, res) => {
    try {
        const { email, newPassword, access_token } = req.body;
        const token = access_token || req.cookies?.sb_access_token || req.headers.authorization?.split(" ")[1];
        if (!email || !newPassword) return res.render('auth/reset-password', { email, access_token, error: "Missing required fields", success: null })

        const pwErrors = validatePassword(newPassword);
        if (pwErrors.length > 0) return res.render('auth/reset-password', { email, access_token, error: pwErrors.join('; '), success: null })

        if (!token) return res.render('auth/reset-password', { email, access_token, error: "Invalid access token", success: null })

        const { data, error } = await supabase.auth.updateUser({
            accessToken: token,
            password: newPassword,
        })
        if (error) return res.render('auth/reset-password', { email, access_token, error: error.message, success: null })
        res.render('auth/login', { error: "Password reset successful! Please log in." })
    } catch (err) {
        console.error('Reset password error:', err.message);
        res.render('auth/reset-password', { error: 'An error occurred. Please try again.', success: null })
    }
})

module.exports = router;