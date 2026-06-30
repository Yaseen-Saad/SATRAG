// This file is made to be runned only one time, but I will leave it afterwards so it counts in hackatime lmao
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
    const filePath = path.join(__dirname, '../data/sample.txt');
    const entries = parseSampleEntries(filePath);
    let seeded = 0;
    for (const entry of entries) {
        try {
            const embedding = await llm.generateEmbedding(`${entry.word} ${entry.definition} ${entry.example_sentence}`);
            const { error } = await supabase.from('vocab_entries').insert({ ...entry, embedding, validation_passed: true, quality_score: 8.0 });
            if (!error) seeded++;
            if (seeded % 20 === 0) {
                console.log(`Seeded ${seeded} entries.`);
            }
        } catch (error) {
            console.error(`Error generating embedding for entry: ${entry.word}`, error);
        }
    }
    console.log("DOOONNEE");
}

module.exports = { seedSampleData }