require('dotenv').config();
const supabase = require('../src/lib/supabase');
const llm = require('../src/lib/llm');

async function generateEmbeddings() {
    const { count } = await supabase.from('sat_questions').select('*', { count: 'exact', head: true }).is('embedding', null);
    console.log(`Questions needing embeddings: ${count}`);

    let done = 0;
    let failed = 0;
    const batchSize = 5;

    while (true) {
        const { data: questions, error } = await supabase
            .from('sat_questions')
            .select('id, stem_plain_text, passage_text, subject, topic, difficulty')
            .is('embedding', null)
            .limit(batchSize);

        if (error) { console.error('Fetch error:', error.message); break; }
        if (!questions || questions.length === 0) break;

        const texts = questions.map(q =>
            [q.stem_plain_text, q.passage_text, q.subject, q.topic].filter(Boolean).join(' ')
        );

        try {
            const embeddings = await llm.generateEmbeddings(texts);
            for (let i = 0; i < questions.length; i++) {
                const { error: updateErr } = await supabase
                    .from('sat_questions')
                    .update({ embedding: embeddings[i] })
                    .eq('id', questions[i].id);
                if (updateErr) failed++;
                else done++;
            }
        } catch (err) {
            failed += questions.length;
            console.error('Batch error:', err.message);
        }

        console.log(`Progress: ${done} done, ${failed} failed (${count - done - failed} remaining)`);
    }

    console.log(`\nComplete: ${done} embeddings generated, ${failed} failed`);
}

generateEmbeddings().catch(err => console.error('Fatal:', err));
