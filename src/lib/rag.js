//This is getting wild, but I think it works. I don't know if this is the best way to do it, but it works for now. I will refactor later if needed.
const supabase = require('./supabase')
const llm = require('./llm')

class RAGEngine {
    async retrieveSimilar(word, topK = 3) {
        try {
            const embedding = await llm.generateEmbedding(word);
            const { data: similar, error } = await supabase.rpc('match_vocab_entries', {
                query_embedding: embedding,
                match_threshold: 0.5,
                match_count: topK
            });
            if (error) throw error;
            return similar || [];
        } catch (err) {
            console.error("Embedding retrieval failed, using fallback:", err.message);
            const { data } = await supabase.from('vocab_entries')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(topK);
            return data || [];
        }
    }
    async getFeedbackContext(word) {
        const { data: wordEntry } = await supabase
            .from('vocab_entries')
            .select('id')
            .eq('word', word.toUpperCase())
            .limit(1)
            .single();
        if (!wordEntry) return [];
        const { data: feedback } = await supabase
            .from("feedback_events")
            .select('satisfaction, helpful_components, problematic_components, comments')
            .eq('word_id', wordEntry.id)
            .order('created_at', { ascending: false })
            .limit(5)
        return feedback || []
    }
    async addEntry(entry) {
        try {
            const embedding = await llm.generateEmbedding(`${entry.word} ${entry.definition} ${entry.example_sentence}`);
            const { data, error } = await supabase.from('vocab_entries').insert({ ...entry, embedding }).select().single();
            if (error) throw error;
            return data;
        } catch (err) {
            console.error("Embedding generation failed, inserting without embedding:", err.message);
            const { data, error } = await supabase.from('vocab_entries').insert({ ...entry, embedding: [] }).select().single();
            if (error) throw error;
            return data;
        }
    }
    async findByWord(word) {
        const { data } = await supabase.from('vocab_entries')
            .select("*").eq('word', word).limit(1).single();
        return data;
    }
    async listRecent(limit = 10) {
        const { data } = await supabase.from('vocab_entries').select("*").order('created_at', { ascending: false }).limit(limit)
        return data
    }
}

module.exports = new RAGEngine()
