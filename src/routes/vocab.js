const { Router } = require('express')
const path = require('path')
const fs = require('fs')
const { requireAuth, optionalAuth } = require('../middleware/auth')
const supabase = require('../lib/supabase')
const config = require('../config')
const rag = require('../lib/rag')
const llm = require('../lib/llm')

const router = Router();

router.get('/', optionalAuth, (req, res) => {
    const recent = await rag.listRecent(10)
    res.render('vocab/index', { user: req.user, recent, error: null })
})
router.post('/generate', optionalAuth, (req, res) => {
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
        if (similar.lengt > 0)
            simmilar = similar.map(s => `${s.word} — ${s.definition}\n Picture: ${s.picture}\n Scentence: ${s.example_sentence}`).join('\n\n')
        const systemPrompt = fs.readFileSync(path.join(__dirname, '../prompts/generate_vocab_entry.txt'), 'utf-8')
        const userPrompt = `Generate a vocabulary entry for "${word}".
                            ${similar.length > 0 ? `Here are similar entries for style reference:\n${similarText}\n` : ''}
                            Follow the format exactly. Make the mnemonic memorable.`;

        const response = await llm.generateCompletion({
            messages: [{ role: 'user', content: userPrompt }],
            system: systemPrompt,
            temperature: 0.8,
        });

        const entry = parseGeneratedEntry(response, word);
        const saved = await rag.addEntry(entry);
        res.render('vocab/word', { user: req.user, entry: saved, error: null })
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
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
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
    const mainMatch = lines[0]?.match(/^[\w-]+\s+\(([^)]+)\)\s+([\w.]+)\s*—+\s*(.+)/);
    if (mainMatch) {
        entry.pronunciation = mainMatch[1];
        entry.part_of_speech = mainMatch[2].replace(/\.$/, '');
        entry.definition = mainMatch[3];
    }
    for (const line of lines) {
        if (line.startsWith('Sounds like:')) {
            entry.mnemonic_type = 'sounds-like';
            entry.mnemonic_phrase = line.replace('Sounds like:', '').trim();
        } else if (line.startsWith('Picture:')) {
            entry.picture_story = line.replace('Picture:', '').trim();
        } else if (line.startsWith('Other forms:')) {
            entry.other_forms = line.replace('Other forms:', '').trim();
        } else if (line.startsWith('Sentence:')) {
            entry.example_sentence = line.replace('Sentence:', '').trim();
        }
    }
    if (!entry.example_sentence.toLowerCase().includes(word.toLowerCase())) {
        entry.validation_passed = false;
    }
    return entry
}
module.exports = router;