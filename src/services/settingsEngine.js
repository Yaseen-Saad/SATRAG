const supabase = require('../lib/supabase');

class settingsEngine {
    constructor() {
        this.supabase = supabase;
    }

    async updateLLMAPIKey(user, key) {
        try {
            await this.supabase.from('public_profiles').update({ llm_apikey: key }).eq('id', user.id);
        } catch (err) {
            return err
        }
    }
    async updateEmbeddingsAPIKey(user, key) {
        try {
            await this.supabase.from('public_profiles').update({ embedding_apikey: key }).eq('id', user.id);
        } catch (err) {
            return err
        }
    }
    async changeFirstName(user, firstName) {
        try {
            await this.supabase.from('public_profiles').update({ first_name: firstName }).eq('id', user.id);
        } catch (err) {
            return err
        }
    }

    async changeLastName(user, lastName) {
        try {
            await this.supabase.from('public_profiles').update({ last_name: lastName }).eq('id', user.id);
        } catch (err) {
            return err

        }
    }
    async changeGradeLevel(user, grade) {
        try {
            await this.supabase.from('public_profiles').update({ grade }).eq('id', user.id);
        } catch (err) {
            return err

        }
    }
    async toggleParticipateInLeaderboard(user, enabled) {
        try {
            await this.supabase.from('public_profiles').update({ participate_in_leaderboard: enabled }).eq('id', user.id);
        } catch (err) { return err }
    }

}
module.exports = new settingsEngine()