require('dotenv').config();
const supabase = require('../src/lib/supabase')
const llm = require('../src/lib/llm')
const { parseSampleEntries } = require('./parser')
const path = require('path')
const fs = require('fs')
async function seedSampleData() {
    const { count } = await supabase
        .from('vocab_entries')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'sample')
    if (count > 0) return
    const filePath = path.join(__dirname, '../data/sample.txt');
    const entries = parseSampleEntries(filePath);
    let seeded = 0;
    let failed = 0;
    for (const entry of entries) {
        try {
            const embedding = await llm.generateEmbedding(`${entry.word} ${entry.definition} ${entry.example_sentence}`);
            const { error } = await supabase.from('vocab_entries').insert({ ...entry, embedding, validation_passed: true, quality_score: 8.0 });
            if (!error) seeded++; else failed++
            if ((seeded + failed) % 50 === 0) console.log(`Seeded ${seeded}/${entries.length} entries (${failed} failed).`);
        } catch {
            failed++
        }
    }
    console.log(`Seeding complete: ${seeded} seeded, ${failed} failed out of ${entries.length} entries.`);
}

async function seedSATQuestions() {
    const { count, error } = await supabase.from('sat_questions').select('*', { count: 'exact', head: true });
    if (count > 0) { console.log("SAT questions already seeded, skipping."); return; }
    const filePath = path.join(__dirname, '../data/sat_questions_with_active.json');
    const questions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const SHIT_TO_ENGLISH = { H: "math", P: "math", Q: "math", S: "math", INI: "reading", CAS: "reading", EOI: "writing", SEC: "writing" }
    const DIFFICULITY_MAP = { E: 'easy', H: "hard", M: "medium" }
    let inserted = 0, failed = 0;
    const rows = [];
    for (const question of questions) {
        try {
            const fq = question.fullQuestion;
            if (!fq || !fq.type) continue;
            const subject = SHIT_TO_ENGLISH[question.primary_class_cd]
            if (!subject) continue;
            const options = fq.answerOptions ? fq.answerOptions.map((o, i) => ({ label: String.fromCharCode(65 + i), content: o.content })) : null;
            const correctAnswer = fq.correct_answer?.[0] || fq.keys?.[0] || "";
            rows.push({
                question_text: fq.stem,
                passage_text: fq.stimulus || null,
                stem_plain_text: (fq.stem || '').replace(/<[^>]+>/g, '').trim(),
                skill_code: question.skill_cd || null,
                skill_description: question.skill_desc || null,
                question_type: fq.type,
                subject, topic: question.primary_class_cd_desc,
                subtopic: question.skill_desc,
                difficulty: DIFFICULITY_MAP[question.difficulty] || 'medium',
                difficulty_band: question.score_band_range_cd || null,
                options, correct_answer: correctAnswer,
                explanation: fq.rationale || null,
                source: 'collegeboard',
                tags: [question.skill_cd, question.primary_class_cd],
                is_active: question.isActive,
            })
        } catch (err) { failed++; }
    }
    for (let i = 0; i < rows.length; i += 200) {
        const batch = rows.slice(i, i + 200);
        const { error } = await supabase.from('sat_questions').insert(batch);
        if (error) console.error('Batch error:', error.message);
        else inserted += batch.length;
        console.log(`Inserted ${inserted}/${rows.length}`);
    }
    console.log(`Seeding complete: ${inserted} inserted, ${failed} failed out of ${questions.length} questions.`);
}

(async function () {
    await seedSampleData()
    await seedSATQuestions()
})()