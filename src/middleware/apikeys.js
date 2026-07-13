const supabase = require('../lib/supabase')
const llm = require('../lib/llm')

async function requireAPIKeys(req, res, next) {
    try {
        const { data: profile, error } = await supabase.from('public_profiles').select('llm_apikey, embedding_apikey').eq('id', req.user.id).single();
        if (error || !profile || !profile.llm_apikey || !profile.embedding_apikey) {
            if (req.path.startsWith('/api/')) {
                return res.status(400).json({ error: 'API keys incomplete. Please complete your API keys.' });
            }
            return res.redirect('/settings?prompt=complete-apikeys');
        }
        req.user.llm_apikey = profile.llm_apikey;
        req.user.embedding_apikey = profile.embedding_apikey;
        llm.setUserKeys(profile.llm_apikey, profile.embedding_apikey);
        res.on('finish', () => llm.clearUserKeys());
        next();
    }
    catch (error) {
        console.error('Error in requireAPIKeys middleware:', error);
        res.status(500).redirect('/settings?prompt=complete-apikeys');
    }
}
module.exports = { requireAPIKeys };