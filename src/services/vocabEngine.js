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
    async addWordToList(userId, listId, wordId) {
        const { data: last, error: err } = await supabase.from('user_word_list_items')
            .select("sort_order").eq('list_id', listId).order('sort_order', { ascending: false }).limit(1).single();
        if (err) throw err;
        const sortOrder = (last?.[0].sort_order ?? -1) + 1
        const { error } = await supabase.from('user_word_list_items')
            .insert({ list_id: listId, word_id: wordId, sort_order: sortOrder })
        if (error && error.code === "23505") throw new Error("Word already in this list")
        if (error) throw error;
    }

}

module.exports = new VocabEngine()