const supabase = require('../lib/supabase');
const config = require('../config');

async function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.sb_access_token || req.headers.authorization?.split(' ')[1];
        if (!token) {
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ error: "Authentication required" })
            }
            return res.redirect('/auth/login')
        }
        const { data: { user }, error } = await supabase.auth.getUser(token)
        if (error || !user) {
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ error: "Invalid or expired token" })
            }
            return res.redirect('/auth/login')
        }
        const rememberMe = req.body.remember == '1';
        res.cookie('sb_access_token', token || data.session.access_token, { httpOnly: true, secure: true, sameSite: 'strict', maxAge: rememberMe ? 2 * 60 * 60 * 1000 : undefined, secure: config.NODE_ENV === 'production' });
        req.user = user;
        next();

    }
    catch (err) {
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