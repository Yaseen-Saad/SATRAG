const supabase = require('../lib/supabase').service

class VocabEngine {
    async getMyLists(userId) {
        const { data } = await supabase.from('user_word_lists').select('*, word_count:user_word_list_items(count)').eq('user_id', userId).order('created_at', { ascending: false });
        return data || [];
    }
    async getSystemlists() {
        const { data } = await supabase.from('word_lists').select('*').eq('visibility', 'system').order('name');
        return data || [];
    }

    async getPublicLists(userId) {
        const { data } = await supabase.from('word_lists')
            .select("*").eq('visibility', 'public').neq('created_by', userId).order('name');
        return data || []
    }

    async getSharedWithMe(userId) {
        const { data } = await supabase.from('list_shares')
            .select('word_lists(*)').eq('shared_with_user_id', userId).order('created_at', { ascending: false });
        return (data || []).map(share => share.word_lists).filter(Boolean);
    }

    async searchLists(query) {
        const { data } = await supabase.from('word_lists').select('*').in('visibility', ['system', 'public']).or(`name.ilike.%${query}%, description.ilike.%${query}%`).order('name');
        return data || [];
    }

    async deleteList(userId, listId) {
        const { error } = await supabase.from('word_lists')
            .delete()
            .eq('created_by', userId)
            .eq('list_id', listId)
        if (error) throw error
        return { success: true }
    }

    async canAccess(listId, userId) {
        const { data } = await supabase.from('word_lists').select('visibility, created_by').eq('id', listId).single();
        if (!data) return false;
        if (data.visibility === 'public' || data.visibility === 'system') return true;
        if (data.created_by === userId) return true;
        if (data.visibility === 'shared') {
            const { count } = await supabase.from('list_shares').select('*', { count: 'exact', head: true }).eq('list_id', listId).eq('shared_with_user_id', userId);
            return count > 0;
        }
        return false;
    }



    
    async createLists(userId, name, description) {
        const { data, error } = await supabase.from('user_word_lists')
            .insert({ user_id: userID, name: name.trim(), description }).select().single();
        if (error) throw error
        return data
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
        // Edit to make te user who created the list is the only one able to edit it, and also edit to make the option to make your list public or private.
        const { data: last, error: err } = await supabase.from('user_word_list_items')
            .select("sort_order").eq('list_id', listId).eq("user_id", userId).order('sort_order', { ascending: false }).limit(1).single();
        if (err) throw err;
        const sortOrder = (last?.[0].sort_order ?? -1) + 1
        const { error } = await supabase.from('user_word_list_items')
            .insert({ list_id: listId, word_id: wordId, sort_order: sortOrder })
        if (error && error.code === "23505") throw new Error("Word already in this list")
        if (error) throw error;
    }
    async removeWordFromList(userId, listId, wordId) {
        const { error } = await supabase.from('user_word_list_items')
            .delete()
            .eq('list_id', listId)
            .eq('word_id', wordId)
        if (error) throw error;
    }

    async getDailyWord() {
        const { data, count } = await supabase.from('vocab_entries').select('id, word, definition, part_of_speech, example_sentence, pronunciation, mnemonic_phrase', { count: 'exact' }).limit(1).single();
        if (!count || count === 0) return null
        const start = new Date(new Date().getFullYear(), 0, 0);
        const diff = Date.now() - start
        const dayOfYear = Math.floor(diff / 86400000)
        return data[dayOfYear % count]
    }
    async getVocabStats(userId) {
        const [totalResult, listResult, sourcesResult, recentResult] = await Promise.all([
            supabase.from('vocab_entries').select('*', { count: 'exact', head: true }),
            supabase.from('user_word_lists').select('id', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('vocab_entries').select('source'),
            supabase.from('vocab_entries').select('word, created_at').order('created_at', { ascending: false }).limit(10),
        ])
        const sources = {}
        for (const e of sourcesResult.data || []) {
            sources[e.source] = (sources[e.source] ?? 0) + 1
        }
        return {
            totalWords: totalResult.count || 0,
            listCount: listResult.count || 0,
            wordsBySource: sources,
            recentWords: recentResult.data || []
        }
    }
}

module.exports = new VocabEngine()