const supabase = require('../lib/supabase');
const llm = require('../lib/llm');

async function checkAPIKeys(req, res, next) {
    try {
        const { data: profile, error } = await supabase
            .from('public_profiles')
            .select('llm_apikey, embedding_apikey, monthly_gen_count, monthly_gen_month')
            .eq('id', req.user.id).single()
        if (error) throw error
        const currentMonth = new Date().toISOString().slice(0, 7)
        let genCount = profile.monthly_gen_count || 0
        let genMonth = profile.monthly_gen_month

        if (genMonth !== currentMonth) {
            genCount = 0
            genMonth = currentMonth
            await supabase.from('public_profiles').update({ monthly_gen_count: 0, monthly_gen_month: currentMonth }).eq('id', req.user.id)
        }
        req.user.genCount = genCount
        req.user.genMonth = genMonth

        if (genCount < 5) {
            req.user.useFreeModels = true
            return next()
        }

        if (!profile.llm_apikey || !profile.embedding_apikey) {
            if (req.accepts('html')) {
                return res.redirect('/settings?prompt=complete-apikeys')
            }
            return res.status(400).json({ error: 'You have used your 5 free generations for this month. Please add your own API keys in Settings to continue.' })
        }
        req.user.llm_apikey = profile.llm_apikey
        req.user.embedding_apikey = profile.embedding_apikey
        llm.setUserKeys(req.user.llm_apikey, req.user.embedding_apikey)
        req.user.useFreeModels = false;
        next();
    } catch (err) {
        console.error('Error in checkAPIKeys middleware', err)
        res.status(500).redirect('/settings?prompt=complete-apikeys')
    }
}

async function incrementGenCount(user) {
    try {
        const currentMonth = new Date().toISOString().slice(0, 7)
        const newCount = (user.genCount || 0) + 1
        await supabase.from('public_profiles').update({
            monthly_gen_count: newCount,
            monthly_gen_month: currentMonth
        }).eq('id', user.id)
    } catch (err) {
        console.error('Failed to increment gen count', err)
    }
}

module.exports = { checkAPIKeys, incrementGenCount }