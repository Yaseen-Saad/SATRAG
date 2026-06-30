//This is getting wild, but I think it works. I don't know if this is the best way to do it, but it works for now. I will refactor later if needed.
const supabase = require('./supabase')
const llm = require('./llm')

class RAGEngine {
    async retrieveSimilar(word, topK = 3) {
        const embedding = await llm.generateEmbedding(word);
        const { data: similar, error } = await supabase.rpc('match_vocab_entries', {
            query_embedding: embedding,
            match_threshold: 0.5,
            match_count: topK
        });
        if (error) throw error;
        return similar;
    }
    async getFeedbackContext(word) {
        const { data: feedback } = await supabase
            .from("feedback_events")
            .select('satisfaction, helpful_components, problematic_components, comments')
            .eq('word_id', supabase.rpc("get_word_id", { word_name: word }))
            .order('created_at', { ascending: false })
            .limit(5)
        return feedback
    }
    async addEntry(entry) {
        const embedding = await llm.generateEmbedding(`${entry.word} ${entry.definition} ${entry.example_sentence}`);
        const { data, error } = await supabase.from('vocab_entries').insert({ ...entry, embedding }).select().single();
        if (error) throw error;
        return data;
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
