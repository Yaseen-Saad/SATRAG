const { Router } = require('express')
const supabase = require('../lib/supabase')
const config = require('../config')

const router = Router();

router.get('/login', (req, res) => {
    res.render('auth/login', { appDomain: config.APP_DOMAIN, error: null })
})
router.get('/signup', (req, res) => {
    res.render('auth/signup', { appDomain: config.APP_DOMAIN, error: null })
})

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return res.render('auth/login', { error: error.message })
    else await supabase.from('public_profiles').update({ last_login: new Date().toISOString() }).eq('id', data.user.id).then(r => { if (r.error) console.error('last_login update failed:', r.error) });
    res.cookie('sb_access_token', data.session.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 86400000 })
    res.redirect('/')
})


router.post('/signup', async (req, res) => {
    const { email, password, firstName, lastName, school } = req.body;
    const { data, error } = await supabase.auth.signUp({
        email, password, options: {
            data: {
                first_name: firstName, last_name: lastName, school,
            }
        }
    })
    if (error) return res.render('auth/signup', { error: error.message })
    if (data.session) {
        await supabase.from('public_profiles').update({
            first_name: firstName, last_name: lastName, school
        }).eq('id', data.user.id);
        res.cookie('sb_access_token', data.session.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 86400000 })
        return res.redirect('/settings')
    }
    res.render('auth/login', { appDomain: config.APP_DOMAIN, error: "Signup successful! Check your email to confirm, then log in." })
})

router.get('/logout', (req, res) => {
    res.clearCookie('sb_access_token');
    res.redirect('/auth/login');
})

router.get("/forgot-password", (req, res) => {
    res.render('auth/forgot-password', { error: null, success: null })
})

router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.render("auth/forgot-password", { error: "Please provide an email", success: null })
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${config.APP_DOMAIN}/auth/reset-password?email=${email}`,
    })
    if (error) return res.render('auth/forgot-password', { error: error.message, success: null })
    res.render('auth/forgot-password', { error: null, success: "Password reset email sent" })
})

router.get('/reset-password', (req, res) => {
    res.render('auth/reset-password', { error: null, success: null })
})

router.post('/reset-password', async (req, res) => {
    const { email, newPassword, access_token } = req.body;
    const token = access_token || req.cookies?.sb_access_token || req.headers.authorization?.split(" ")[1];
    if (!email || !newPassword) return res.render('auth/reset-password', { email, access_token, error: "Missing required fields", success: null })
    if (newPassword.length < 6) return res.render('auth/reset-password', { email, access_token, error: "Password must be at least 6 characters long", success: null })
    if (!token) return res.render('auth/reset-password', { email, token, error: "Invalid access token", success: null })


    const { data, error } = await supabase.auth.updateUser({
        accessToken: token,
        password: newPassword,
    })
    if (error) return res.render('auth/reset-password', { email, token, error: error.message, success: null })
    res.render('auth/login', { appDomain: config.APP_DOMAIN, error: "Password reset successful! Please log in." })
})

module.exports = router;