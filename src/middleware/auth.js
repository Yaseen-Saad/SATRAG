const supabase = require('../lib/supabase');

async function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.sb_access_token || req.headers.authorization?.split(' ')[1];
        if (!token) {
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ error: "Autehntication required" })
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