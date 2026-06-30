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

