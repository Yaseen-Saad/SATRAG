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

    async getlist(listId, userId) {
        const { data: list } = await supabase.from('word_lists').select('*').eq('id', listId).single();
        if (!list) return { list: null, words: [] }
        if (list.visibility === 'private' && list.created_by !== userId) {
            const can = await this.canAccess(listId, userId)
            if (!can) return { list: null, words: [] }
        }
        const { data: words } = await supabase.from('word_list_entries').select('*, vocab_entries(*)').eq('list_id', listId).order('sort_order', { ascending: true });
        const words = (items || []).map(item => item.vocab_entries).filter(Boolean);
        const { count } = await supabase.from('word_list_entries').select('*', { count: 'exact', head: true }).eq('list_id', listId);
        return { list: { ...list, word_count: count || 0 }, words }
    }
    // Make sure the only one who can edit the list is its owner lol
    async addWordToList(listId, wordId, userId) {
        const { data: last, error: err } = await supabase.from('word_list_entries')
            .select("sort_order").eq('list_id', listId).eq("created_by", userId).order('sort_order', { ascending: false }).limit(1).single();
        if (err) throw err;
        const sortOrder = (last?.[0].sort_order ?? -1) + 1
        const { error } = await supabase.from('word_list_entries')
            .insert({ list_id: listId, word_id: wordId, sort_order: sortOrder })
        if (error && error.code === "23505") throw new Error("Word already in this list")
        if (error) throw error;
        await supabase.from('word_lists').update({ word_count: supabase.raw('word_count + 1'), updated_at: new Date().toISOString() }).eq('id', listId)
    }

    async removeWordFromList(listId, wordId, userId) {
        const { error } = await supabase.from('word_list_entries')
            .delete().eq("created_by", userId)
            .eq('list_id', listId)
            .eq('word_id', wordId)
        if (error) throw error;
        const { error2 } = await supabase.from('word_lists').update({
            word_count: supabase.raw('word_count - 1'), updated_at: new Date().toISOString()
        }).eq('id', listId)
        if (error2) throw error2;
    }

    async cloneList(userId, listId,) {
        const { list, words } = await this.getList(listId, userId)
        if (!list) throw new Error("List not found")
        if (!this.canAccess(listId, userId)) throw new Error("Access denied")
        const { data: copy, error } = await supabase.from('word_lists')
            .insert({ name: `${list.name.trim()} (clone)`, description: list.description, visibility: 'private', created_by: userId, cloned_from: listId, source_book: list.source_book }).select().single();
        if (error) throw error
        for (const word of words) {
            const { error: err } = await supabase.from('word_list_entries').insert({ list_id: copy.id, word_id: word.id, sort_order: word.sort_order || 0 })
            if (err && err.code !== "23505") throw err;
        }
        return copy;
    }

    async shareList(listId, ownerId, email) {
        const { data: list, error: err } = await supabase.from('word_lists').select('created_by').eq('id', listId).single();
        if (err || !list || list.created_by !== ownerId) throw new Error(err || "You do not own this list");
        const { data: user, error: err2 } = await supabase.from('public_profiles').select('id').eq('email', email).single();
        if (err2 || !user) throw new Error(err2 || "User not found");
        const { error } = await supabase.from('list_shares').insert({ list_id: listId, shared_with_user_id: user.id, shared_by_user_id: ownerId })
        if (error && error.code === "23505") throw new Error("List already shared with this user")
        if (error) throw error;
        const { error: err4 } = await supabase.from('word_lists').update({ visibility: 'shared' }).eq('id', listId);
        if (err4) throw err4
        return { success: true }
    }

    async unshareList(listId, ownerId, email) {
        const { data: list, error: err } = await supabase.from('list_shares').delete().eq('shared_with_user_id', userId).eq('list_id', listId).single(); const { error } = await supabase.from('list_shares').delete().eq('list_id', listId).eq('shared_with_user_id', user.id).eq('shared_by_user_id', ownerId);
        if (error) throw error;
        return { success: true }
    }

    async changeVisibility(listId, userId, visibility) {
        await supabase.from('word_lists').update({ visibility }).eq('id', listId).eq('created_by', userId)
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