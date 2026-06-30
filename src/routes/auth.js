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
    res.cookie('sb_access_token', data.session.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 86400000 })
    res.redirect('/')
})


router.post('/signup', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return res.render('auth/signup', { error: error.message })
    res.render('auth/login', { appDomain: config.APP_DOMAIN, error: "Signup successful! Please log in." })
})

router.get('/logout', (req, res) => {
    res.clearCookie('sb_access_token');
    res.redirect('/auth/login');
})

module.exports = router;