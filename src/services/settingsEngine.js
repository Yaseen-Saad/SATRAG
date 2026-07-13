const supabase = require('../lib/supabase');

class settingsEngine {
    async updateAll(user, updates) {
        const { error } = await supabase.from('public_profiles').update(updates).eq('id', user.id);
        if (error) throw error;
        return { success: true };
    }
}
module.exports = new settingsEngine()