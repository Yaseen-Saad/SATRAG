const supabase = require('../lib/supabase').service

class VocabEngine {
    async getLists(userId) {
        const { data } = await supabase.from('user_word_lists').select('*, word_count:user_word_list_items(count)').eq('user_id', userId).order('created_at', { ascending: false });
        return data?.map(list => ({ ...list, word_count: list.word_count?.[0]?.count || 0 })) || [];
    }

    async createLists(userId, name, description) {
        const { data, error } = await supabase.from('user_word_lists')
            .insert({ user_id: userID, name: name.trim(), description }).select().single();
        if (error) throw error
        return data
    }

    async deleteLists(userId, name, listId, description) {
        const { data, error } = await supabase.from('user_word_lists')
            .delete()
            .eq('user_id', userId)
            .eq('list_id', listId)
            .eq('name', name.trim())
            .eq('description', description)
            .select()
            .single();
        if (error) throw error
        return { success: true }
    }
    async getListWords(userId, name, listId) {
        const { data, error } = await supabase.from('user_word_list_items')
            .select('*, vocab_entries(*)')
            .eq('list_id', listId)
            .order('sort_order', { ascending: true });
        if (error) throw error
        return data?.map(item => item.vocab_entries) || [];

    }
}

module.exports = new VocabEngine()