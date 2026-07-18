const { service: supabase } = require('../lib/supabase')

class FlashcardsEngine {
    async exportAnki(userId) {
        const { data: cards } = await supabase.from('user_flashcard_progress').select('*, vocab_entries(*)').eq('user_id', userId)
        if (!cards || !cards.length) return []
        return cards.map(card => ({
            Word: card.vocab_entries?.word || '',
            Pronunciation: card.vocab_entries?.pronunciation || '',
            'Part of Speech': card.vocab_entries?.part_of_speech || '',
            Definition: card.vocab_entries?.definition || '',
            Example: card.vocab_entries?.example_sentence || '',
            Stage: card.stage,
            "Ease Factor": card?.ease_factor?.toFixed(2) || 2.5,
            Interval: card.interval_days + 'd',
            Mnemonic: card.vocab_entries?.mnemonic_phrase || '',
            definition: card.vocab_entries?.definition || ''
        }))
    }
    async importAnki(userId, cards) {
        const rag = require('../lib/rag');
        const created = []
        for (const card of cards) {
            const word = (card.word || card.Word || card['Word'] || '').trim().toUpperCase()
            if (!word) continue;
            const existing = await rag.findByWord(word)
            if (existing) { created.push(existing); continue; }
            const saved = await rag.addEntry({
                word, pronunciation: card.pronunciation || card.Pronunciation || card['Pronunciation'] || '',
                part_of_speech: card.part_of_speech || card['Part of Speech'] || card['Part of Speech'] || '',
                definition: card.definition || card.Definition || card['Definition'] || '',
                example_sentence: card.example_sentence || card.Example || card['Example'] || '',
                mnemonic_phrase: card.mnemonic_phrase || card.Mnemonic || card['Mnemonic'] || '',
                source: 'imported', validation_passed: true, quality_score: 5.0
            })
            await this.ensureWordInitialized(userId, saved.id)
            created.push(saved)
        }
        return created
    }

    async getStats(userId) {
        const now = new Date().toISOString()
        const [total, due, mastered] = await Promise.all([
            supabase.from('user_flashcard_progress').select('id', { count: 'exact', head: true }).eq('user_id', userId),
            supabase.from('user_flashcard_progress').select('id', { count: 'exact', head: true }).eq('user_id', userId).lte('next_review', now),
            supabase.from('user_flashcard_progress').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('stage', 3)
        ])

        const { count: listCount } = await supabase.from('word_lists').select('id', { count: 'exact', head: true }).eq('created_by', userId).neq('visibility', 'system')
        return {
            totalCards: total.count || 0,
            dueToday: due.count || 0,
            mastered: mastered.count || 0,
            totalLists: listCount || 0
        }
    }

    async getListDueCounts(userId) {
        const { data: lists } = await supabase.from('word_lists').select('id, name, word_count').eq('created_by', userId).neq('visibility', 'system')
        if (!lists || lists.length === 0) return []
        const { data: progress } = await supabase
            .from('user_flashcard_progress').select('word_id').eq('user_id', userId).lte('next_review', new Date().toISOString())

        const dueIds = new Set((progress || []).map(prog => prog.word_id))

        const { data: entries } = await supabase.from('word_list_entries').select('list_id, word_id').eq('user_id', userId).in('list_id', lists.map(list => list.id))

        return lists.map(list => ({
            ...list, dueCount: (entries || []).filter(entry => entry.list_id === list.id && dueIds.has(entry.word_id)).length
        }))
    }

    async getSessionCards(userId, { listId, wordId, all }) {
        if (wordId) {
            await this.ensureWordInitialized(userId, wordId)
            const { data } = await supabase.from('user_flashcard_progress').select('*, vocab_entries(*)').eq('user_id', userId).eq('word_id', wordId).single()
            return data ? [data] : []
        }
        if (listId) {
            const { data: entries } = await supabase.from('word_list_entries').select('word_id').eq('list_id', listId).eq('user_id', userId)
            if (!entries || entries.length === 0) return []
            const wordIds = entries.map(entry => entry.word_id)
            await Promise.all(wordIds.map(wordId => this.ensureWordInitialized(userId, wordId)))
            const { data } = await supabase.from('user_flashcard_progress').select('*, vocab_entries(*)').eq('user_id', userId).in('word_id', wordIds).order('next_review', { ascending: true })
            return data || []
        }
        if (all) {
            const { data } = await supabase.from('user_flashcard_progress').select('*, vocab_entries(*)').eq('user_id', userId).order('next_review', { ascending: true })
            return data || []
        }
        return []
    }

    async ensureWordInitialized(userId, wordId) {
        const { data: existing } = await supabase
            .from('user_flashcard_progress').select('id').eq('user_id', userId).eq('word_id', wordId).maybeSingle()
        if (existing) return
        const now = new Date().toISOString()
        await supabase.from('user_flashcard_progress').insert({ user_id: userId, word_id: wordId, stage: 0, ease_factor: 2.5, next_review: now, interval_days: 0, review_count: 0, correct_count: 0, incorrect_count: 0 })
    }

    async submitReview(userId, wordId, quality) {
        const { data: card } = await supabase.from('user_flashcard_progress').select('*').eq('user_id', userId).eq('word_id', wordId).single()
        if (!card) throw new Error('Card not found')
        const updates = await this.applySM2(card, quality)
        const { error } = await supabase.from('user_flashcard_progress').update(updates).eq('id', card.id)
        if (error) throw error
        return { success: true }
    }

    async applySM2(card, quality) {
        let { stage, ease_factor, interval_days: interval } = card
        if (quality < 3) {
            stage = 0
            interval = 0
        } else {
            if (stage === 0) { stage = 1; interval = 1 }
            else if (stage === 1) { stage = 2; interval = 6 }
            else { stage += 1; interval = Math.round(interval * ease_factor) }
        }
        ease_factor = Math.max(1.3, ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
        const now = new Date()
        const next_review = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000).toISOString()
        return { stage, ease_factor, interval_days: interval, next_review, last_reviewed: now.toISOString(), review_count: card.review_count + 1, correct_count: card.correct_count + (quality >= 3 ? 1 : 0), incorrect_count: card.incorrect_count + (quality < 3 ? 1 : 0) }
    }

    async removeWord(userId, wordId) {
        await supabase.from('user_flashcard_progress').delete().eq('user_id', userId).eq('word_id', wordId)
    }
}

module.exports = new FlashcardsEngine();