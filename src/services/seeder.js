const supabase = require('../lib/supabase')
const llm = require('../lib/llm')
const { parseSampleEntries } = require('../lib/parser')
const path = require('path')

async function seedSampleData() {
    const { count } = await supabase
        .from('vocab_entries')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'sample')
    if (count > 0) {
        return;
    }
    const filePath = path.join(__dirname, '../../data/sample.txt');
    const entries = parseSampleEntries(filePath);
    let seeded = 0;
    let failed = 0;
    for (const entry of entries) {
        try {
            const embedding = await llm.generateEmbedding(`${entry.word} ${entry.definition} ${entry.example_sentence}`);
            const { error } = await supabase.from('vocab_entries').insert({ ...entry, embedding, validation_passed: true, quality_score: 8.0 });
            if (!error) {
                seeded++;
            } else {
                failed++;
            }
            if ((seeded + failed) % 50 === 0) {
                console.log(`Seeded ${seeded}/${entries.length} entries (${failed} failed).`);
            }
        } catch {
            failed++;
        }
    }
    console.log(`Seeding complete: ${seeded} seeded, ${failed} failed out of ${entries.length} entries.`);
}

module.exports = { seedSampleData }