const supabase = require('../lib/supabase').service
const rag = require('../lib/rag')

class VocabEngine {
    async getMyLists(userId) {
        const { data } = await supabase.from('word_lists').select('*, word_count:word_list_entries(count)').eq('created_by', userId).order('created_at', { ascending: false });
        return data || [];
    }
    async getSystemLists() {
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
        const { data } = await supabase.from('word_lists').select('*').in('visibility', ['system', 'public']).or(`name.ilike.%${query}%,description.ilike.%${query}%`).order('name');
        return data || [];
    }

    async deleteList(userId, listId) {
        const { error } = await supabase.from('word_lists')
            .delete().eq('id', listId).eq('created_by', userId)
        if (error) throw error
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

    async autoAddFromWrongAnswer(userId, questionData) {
        try {
            let lists = await this.getMyLists(userId)
            let mistakesList = lists.find(list => list.name === "Mistakes" && list.visibility === 'private')
            if (!mistakesList) {
                mistakesList = await this.createList(userId, 'Mistakes', 'Words from questions you answered incorrectly', 'private')
            }
            const wordsToFind = []
            if (questionData.passage_text) {
                const match = questionData.passage_text.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g)
                if (match) wordsToFind.push(...match.slice(0, 5))
            }

            for (const word of wordsToFind) {
                const entry = await rag.findByWord(word.toUpperCase())
                if (entry) {
                    const alreadyIn = await supabase.from('word_list_entries').select('id').eq('list_id', mistakesList.id).eq('word_id', entry.id).maybeSingle()
                    if (!alreadyIn) await this.addWordToList(mistakesList.id, entry.id)
                }
            }
            return { listId: mistakesList.id, wordsFound: wordsToFind.length }
        } catch (error) {
            console.error(error)
            return { listId: null, wordsFound: 0 }
        }
    }

    async getList(listId, userId) {
        const { data: list } = await supabase.from('word_lists').select('*').eq('id', listId).single();
        if (!list) return { list: null, words: [] }
        if (list.visibility === 'private' && list.created_by !== userId) {
            const can = await this.canAccess(listId, userId)
            if (!can) return { list: null, words: [] }
        }
        const { data: items } = await supabase.from('word_list_entries').select('*, vocab_entries(*)').eq('list_id', listId).order('sort_order', { ascending: true });
        const words = (items || []).map(item => item.vocab_entries).filter(Boolean);
        const { count } = await supabase.from('word_list_entries').select('*', { count: 'exact', head: true }).eq('list_id', listId);
        return { list: { ...list, word_count: count || 0 }, words }
    }

    async addWordToList(listId, wordId) {
        const { data: last } = await supabase.from('word_list_entries')
            .select("sort_order").eq('list_id', listId).order('sort_order', { ascending: false }).limit(1);
        const sortOrder = ((last?.[0]?.sort_order) ?? -1) + 1
        const { error } = await supabase.from('word_list_entries')
            .insert({ list_id: listId, word_id: wordId, sort_order: sortOrder })
        if (error && error.code === "23505") throw new Error("Word already in this list")
        if (error) throw error;
        await supabase.from('word_lists').update({ updated_at: new Date().toISOString() }).eq('id', listId)
    }

    async removeWordFromList(listId, wordId) {
        const { error } = await supabase.from('word_list_entries')
            .delete().eq('list_id', listId).eq('word_id', wordId)
        if (error) throw error;
        await supabase.from('word_lists').update({ updated_at: new Date().toISOString() }).eq('id', listId)
    }

    async cloneList(userId, listId) {
        const { list, words } = await this.getList(listId, userId)
        if (!list) throw new Error("List not found")
        if (!(await this.canAccess(listId, userId))) throw new Error("Access denied")
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
        const { data: user } = await supabase.from('public_profiles').select('id').eq('email', email).single();
        if (!user) throw new Error("User not found");
        const { error } = await supabase.from('list_shares').delete().eq('list_id', listId).eq('shared_with_user_id', user.id);
        if (error) throw error;
    }

    async changeVisibility(listId, userId, visibility) {
        await supabase.from('word_lists').update({ visibility }).eq('id', listId).eq('created_by', userId)
    }

    async getDailyWord() {
        const { data, count } = await supabase.from('vocab_entries').select('id, word, definition, part_of_speech, example_sentence, pronunciation, mnemonic_phrase', { count: 'exact' });
        if (!count || count === 0) return null;
        const start = new Date(new Date().getFullYear(), 0, 0);
        const diff = Date.now() - start
        const dayOfYear = Math.floor(diff / 86400000)
        return data[dayOfYear % count]
    }

    async getVocabStats(userId) {
        const [totalResult, listResult, sourcesResult, recentResult] = await Promise.all([
            supabase.from('vocab_entries').select('*', { count: 'exact', head: true }),
            supabase.from('word_lists').select('id', { count: 'exact', head: true }).eq('created_by', userId),
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

    async getLists(userId) {
        return this.getMyLists(userId);
    }

    async createList(userId, name, description, visibility = 'private') {
        const { data, error } = await supabase.from('word_lists')
            .insert({ name, description, visibility, created_by: userId }).select().single();
        if (error) throw error;
        return data;
    }

    async generateShareLink(listId, userId) {
        const { data: list } = await supabase.from('word_lists')
            .select('created_by, share_token').eq('id', listId).single();
        if (!list || list.created_by !== userId) throw new Error("Not your list");
        if (!list.share_token) {
            await supabase.from('word_lists')
                .update({ share_token: crypto.randomUUID(), share_token_enabled: true })
                .eq('id', listId);
        } else {
            await supabase.from('word_lists')
                .update({ share_token_enabled: true }).eq('id', listId);
        }
        const { data: updated } = await supabase.from('word_lists')
            .select('share_token').eq('id', listId).single();
        return updated.share_token;
    }

    async getListByShareToken(token) {
        const { data: list } = await supabase.from('word_lists').select("*").eq('share_token', token).eq('share_token_enabled', true).single();
        if (!list) return null;
        const { data: items } = await supabase.from('word_list_entries').select('*, vocab_entries(*)').eq('list_id', list.id).order('sort_order', { ascending: true });
        const words = (items || []).map(item => item.vocab_entries).filter(Boolean);
        return { list, words };
    }

    async toggleShareToken(listId, userId, enable) {
        const { data: list } = await supabase.from('word_lists').select('created_by, share_token').eq('id', listId).single();
        if (!list || list.created_by !== userId) throw new Error("Not your list");
        const update = { share_token_enabled: enable };
        if (enable && !list.share_token) update.share_token = crypto.randomUUID();
        await supabase.from('word_lists').update(update).eq('id', listId);
    }
}

module.exports = new VocabEngine()