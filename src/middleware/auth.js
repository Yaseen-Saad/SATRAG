const supabase = require('../lib/supabase');
const config = require('../config');

async function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.sb_access_token || req.headers.authorization?.split(' ')[1];
        if (!token) {
            if (!req.accepts('html')) {
                return res.status(401).json({ error: "Authentication required" })
            }
            return res.redirect('/auth/login')
        }
        const { data: { user }, error } = await supabase.auth.getUser(token)
        if (error || !user) {
            if (!req.accepts('html')) {
                return res.status(401).json({ error: "Invalid or expired token" })
            }
            return res.redirect('/auth/login')
        }
        const rememberMe = req.method === 'POST' ? req.body.remember === '1' : req.cookies?.sb_access_token ? true : false;
        res.cookie('sb_access_token', token, { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'lax', maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : undefined });
        req.user = user;
        next();
    } catch (err) {
        console.error("Auth error", err)
        res.status(500).send("Auth Error")
    }
}

async function optionalAuth(req, res, next) {
    try {
        const token = req.cookies?.sb_access_token || req.headers.authorization?.replace('Bearer ', '');
        if (token) {
            const { data: { user } } = await supabase.auth.getUser(token);
            req.user = user || null;
        }
    } catch {
        req.user = null;
    }
    next();
}

module.exports = { requireAuth, optionalAuth }; 