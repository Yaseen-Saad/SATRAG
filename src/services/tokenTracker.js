const supabase = require('../lib/supabase');

class tokenTracker {
    async logUsage(userId, { operation, usage, model }) {
        if (!userId || !usage) return
        try {
            await supabase.from('token_usage_log').insert({
                user_id: userId,
                operation, prompt_tokens: usage.prompt_tokens || 0,
                completion_tokens: usage.completion_tokens || 0,
                total_tokens: usage.total_tokens || 0,
                model: model || null
            })
        } catch (err) {
            console.error('Failed to log token usage:', err.message)
        }
    }

    async getMonthlyUsage(userId) {
        try {
            const { data, error } = await supabase.rpc('get_monthly_token_usage', { p_user_id: userId });
            if (error) throw error;
            return data || 0;
        } catch (e) {
            console.error('Failed to get monthly token usage:', e.message);
            return 0;
        }
    }

    async getUsageBreakdown(userId) {
        try {
            const { data, error } = await supabase.from('token_usage_log')
                .select('operation, total_tokens, created_at')
                .eq('user_id', userId).gte('created_at', new Date(new Date().setDate(1)).toISOString())
                .order('created_at', { ascending: false })
            if (error) throw error;
            const breakdown = {}
            for (const row of (data || [])) {
                if (!breakdown[row.operation]) breakdown[row.operation] = 0;
                breakdown[row.operation] += row.total_tokens
            }
            return breakdown
        } catch (e) {
            console.error('Failed to get usage breakdown:', e.message);
            return {}
        }
    }
}
module.exports = new tokenTracker()