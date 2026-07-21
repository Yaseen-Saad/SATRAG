const supabase = require('../lib/supabase');
const config = require('../config');

const COOKIE_OPTS = { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'lax' };

function setAuthCookies(res, session, remember) {
    const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : undefined;
    const opts = { ...COOKIE_OPTS, maxAge };
    res.cookie('sb_access_token', session.access_token, opts);
    res.cookie('sb_refresh_token', session.refresh_token, opts);
}

async function refreshSession(refreshToken, res, remember) {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data?.session) return null;
    setAuthCookies(res, data.session, remember);
    return data.session.user;
}

async function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.sb_access_token || req.headers.authorization?.split(' ')[1];
        if (!token) {
            if (!req.accepts('html')) return res.status(401).json({ error: "Authentication required" });
            return res.redirect('/auth/login');
        }
        const rememberMe = req.method === 'POST' ? req.body.remember === '1' : !!req.cookies?.sb_access_token;

        let { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            const refreshToken = req.cookies?.sb_refresh_token;
            if (refreshToken) {
                user = await refreshSession(refreshToken, res, rememberMe);
            }
            if (!user) {
                if (!req.accepts('html')) return res.status(401).json({ error: "Invalid or expired token" });
                return res.redirect('/auth/login');
            }
        } else {
            setAuthCookies(res, { access_token: token, refresh_token: req.cookies?.sb_refresh_token || '' }, rememberMe);
        }

        req.user = user;
        next();
    } catch (err) {
        console.error("Auth error", err);
        res.status(500).send("Auth Error");
    }
}

async function optionalAuth(req, res, next) {
    try {
        const token = req.cookies?.sb_access_token || req.headers.authorization?.replace('Bearer ', '');
        if (token) {
            let { data: { user } } = await supabase.auth.getUser(token);
            if (!user && req.cookies?.sb_refresh_token) {
                user = await refreshSession(req.cookies?.sb_refresh_token, res, !!req.cookies?.sb_access_token);
            }
            req.user = user || null;
        }
    } catch {
        req.user = null;
    }
    next();
}

module.exports = { requireAuth, optionalAuth };
