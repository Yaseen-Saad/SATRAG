const supabase = require('../lib/supabase')

async function requireProfileComplete(req, res, next) {
    try {
        const { data: profile, error } = await supabase.from('public_profiles').select('first_name, last_name, school').eq('id', req.user.id).single();
        if (error || !profile || !profile.first_name || !profile.last_name || !profile.school) {
            if (req.path.startsWith('/api/')) {
                return res.status(400).json({ error: 'Profile incomplete. Please complete your profile.' });
            }
            return res.redirect('/settings?prompt=complete-profile');
        }
        next();
    }
    catch (error) {
        console.error('Error in requireProfileComplete middleware:', error);
        res.status(500).redirect('/settings?prompt=complete-profile');
    }
}
module.exports = { requireProfileComplete };