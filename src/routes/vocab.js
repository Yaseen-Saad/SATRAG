const { Router } = require('express')
const path = require('path')
const fs = require('fs')
const { requireAuth, optionalAuth } = require('../middleware/auth')
const supabase = require('../lib/supabase')
const config = require('../config')
const rag = require('../lib/rag')
const llm = require('../lib/llm')
const qualityChecker = require('../lib/qualityChecker')
const evaluator = require('../lib/vocabularyEvaluator')

const router = Router();

router.get('/', optionalAuth, async (req, res) => {
    const { word } = req.query
    if (word && word.trim()) {
        return res.redirect(`/vocab/${word.trim().toUpperCase()}`)
    }
    const recent = await rag.listRecent(10)
    res.render('vocab/index', { user: req.user, recent, error: null })
})


router.post('/generate', optionalAuth, async (req, res) => {
    let { word } = req.body;
    if (!word || word.trim() === '') {
        const recent = await rag.listRecent(10)
        return res.render('vocab/index', { user: req.user, recent, error: "Please provide a word to generate." })
    }
    try {
        word = word.trim().toUpperCase();
        const existing = await rag.findByWord(word);
        if (existing) {
            return res.render('vocab/word', { user: req.user, entry: existing, error: null })
        }
        const similar = await rag.retrieveSimilar(word, 3)
        let simmilar = ''
        if (similar.length > 0)
            simmilar = similar.map(s => `${s.word} — ${s.definition}\n Picture: ${s.picture_story}\n Scentence: ${s.example_sentence}`).join('\n\n')
        const systemPrompt = fs.readFileSync(path.join(__dirname, '../prompts/generate_vocab_entry.txt'), 'utf-8')
        const userPrompt = `Generate a vocabulary entry for "${word}".
                            ${similar.length > 0 ? `Here are similar entries for style reference:\n${simmilar}\n` : ''}
                            Follow the format exactly. Make the mnemonic memorable.`;

        const response = await llm.generateCompletion({
            messages: [{ role: 'user', content: userPrompt }],
            system: systemPrompt,
            temperature: 0.8,
        });

        const entry = parseGeneratedEntry(response.content, word);
        const quality = qualityChecker.assessQuality(entry);
        const evaluationResult = evaluator.evaluateEntry(entry, word);
        entry.quality_score = quality.overall
        entry.validation_passed = evaluationResult.isValid
        const saved = await rag.addEntry(entry);

        res.render('vocab/word', { user: req.user, entry: saved, error: null, isGenerated: true })
    } catch (err) {
        console.error("Generation error", err)
        const recent = await rag.listRecent(10)
        res.render('vocab/index', { user: req.user, recent, error: err.message })
    }
})

router.get('/:word', optionalAuth, async (req, res) => {
    const entry = await rag.findByWord(req.params.word.toUpperCase());
    if (!entry) {
        return res.render('vocab/index', { user: req.user, recent: await rag.listRecent(10), error: `No entry found for "${req.params.word}"` })
    }
    res.render('vocab/word', { user: req.user, entry, error: null })
});
function parseGeneratedEntry(text, word) {
    const lines = text.split('\n').map(l => l.trim());
    const entry = {
        word,
        pronunciation: '',
        part_of_speech: '',
        definition: '',
        mnemonic_type: '',
        mnemonic_phrase: '',
        picture_story: '',
        other_forms: '',
        example_sentence: '',
        source: 'generated',
        validation_passed: true,
        quality_score: 7.0,
    };
    for (const line of lines) {
        const mainMatch = line?.match(/^[\w-]+\s+\(([^)]+)\)\s+([\w.]+)\s*—+\s*(.+)/);
        if (mainMatch) {
            entry.pronunciation = mainMatch[1];
            entry.part_of_speech = mainMatch[2].replace(/\.$/, '');
            entry.definition = mainMatch[3];
            break;
        }
    } let currentField = null;
    for (const line of lines) {
        if (line.startsWith('Sounds like:')) {
            entry.mnemonic_type = 'sounds-like';
            entry.mnemonic_phrase = line.replace('Sounds like:', '').trim();
            currentField = null;
        } else if (line.startsWith('Picture:')) {
            entry.picture_story = line.replace('Picture:', '').trim();
            currentField = 'picture_story';
        } else if (line.startsWith('Other forms:')) {
            entry.other_forms = line.replace('Other forms:', '').trim();
            currentField = 'other_forms';
        } else if (line.startsWith('Sentence:')) {
            entry.example_sentence = line.replace('Sentence:', '').trim();
            currentField = 'example_sentence';
        } else if (currentField && line && !line.match(/^[A-Z]/)) {
            // Continuation of multi-line field
            entry[currentField] += ' ' + line;
        }
    }

    if (!entry.example_sentence.toLowerCase().includes(word.toLowerCase())) {
        entry.validation_passed = false;
    }
    return entry;
}


router.get('/generate/:word', optionalAuth, async (req, res) => {
    const word = req.params.word.toUpperCase();
    const existing = await rag.findByWord(word)
    if (!existing) {
        return res.render('vocab/index', { user: req.user, recent: await rag.listRecent(10), error: `No entry found for "${word}"` })
    }
    res.render('vocab/regenerate', { user: req.user, word, entry: existing, error: null })
})

router.post('/regenerate', optionalAuth, async (req, res) => {
    try {
        const { word, reason, specificIssue, improvements, partOfSpeech } = req.body
        const w = word.trim().toUpperCase()
        const negativeContent = `NEGATIVE FEEDBACK FOR ${w}:\nIssue: ${reason} — ${specificIssue}\nAvoid: ${improvements}`
        await supabase.from('rag_feedback_examples').insert({ word: w, type: "negative", content: negativeContent })
        const similar = await rag.retrieveSimilar(w, 3);
        const contextExamples = similar.map(s => `${s.word} — ${s.definition}`).join('\n');
        const systemPrompt = fs.readFileSync(path.join(__dirname, '../prompts/generate_vocab_entry.txt'), 'utf-8');
        const userPrompt = `Generate a vocabulary entry for "${w}".\nAvoid these issues from previous attempt:\n- ${reason}: ${specificIssue || improvements || 'improve quality'}\n\n${similar.length > 0 ? `Style reference:\n${contextExamples}\n` : ''}\nFollow the format exactly.`;

        const response = await llm.generateCompletion({
            messages: [{ role: 'user', content: userPrompt }],
            system: systemPrompt,
            temperature: 0.8,
        });
        const entry = parseGeneratedEntry(response.content, w);
        const quality = qualityChecker.assessQuality(entry);
        const evalResult = evaluator.evaluateEntry(entry, w);
        entry.quality_score = quality.overall;
        entry.validation_passed = evalResult.isValid;

        const saved = await rag.addEntry(entry);
        if (req.body.satisfaction && parseInt(req.body.satisfaction) >= 7) {
            const positiveContent = `POSITIVE FEEDBACK FOR ${w}:\n${req.body.satisfaction}/10 Satisfied with the regenerated entry.`;
            await supabase.from('rag_feedback_examples').insert({ word: w, type: "positive", content: positiveContent })
        }
        res.render('vocab/word', { user: req.user, entry: saved, error: null, isRegenerated: true })
    } catch (err) {
        res.render('vocab/index', { user: req.user, recent: await rag.listRecent(10), error: err.message })
    }
})

module.exports = router;