const { Router } = require('express')
const path = require('path')
const fs = require('fs')
const { requireAuth, optionalAuth } = require('../middleware/auth')
const supabase = require('../lib/supabase').service
const config = require('../config')
const rag = require('../lib/rag')
const llm = require('../lib/llm')
const qualityChecker = require('../lib/qualityChecker')
const evaluator = require('../lib/vocabularyEvaluator')
const vocabEngine = require('../services/vocabEngine')
const { parseGeneratedEntry } = require('../lib/utils')
const { checkAPIKeys, incrementGenCount } = require('../middleware/useFreeModels')
const router = Router();

router.get('/', requireAuth, async (req, res) => {
    const { word } = req.query
    if (word && word.trim()) {
        return res.redirect(`/vocab/${word.trim().toUpperCase()}`)
    }
    const recent = await rag.listRecent(10)
    res.render('vocab/index', { user: req.user, recent, error: null })
})

router.post('/generate', requireAuth, checkAPIKeys, async (req, res) => {
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
        let similarText = ''
        if (similar.length > 0)
            similarText = similar.map(s => `${s.word} — ${s.definition}\n Picture: ${s.picture_story}\n Sentence: ${s.example_sentence}`).join('\n\n')
        const systemPrompt = fs.readFileSync(path.join(__dirname, '../prompts/generate_vocab_entry.txt'), 'utf-8')
        const userPrompt = `Generate a vocabulary entry for "${word}".
                            ${similar.length > 0 ? `Here are similar entries for style reference:\n${similarText}\n` : ''}
                            Follow the format exactly. Make the mnemonic memorable.`;

        let response = await llm.generateCompletion({
            messages: [{ role: 'user', content: userPrompt }],
            system: systemPrompt,
            temperature: 0.8,
            apiKey: req.user.useFreeModels ? undefined : req.user.llm_apikey
        });

        let entry = parseGeneratedEntry(response.content, word);
        if (!entry.definition || !entry.definition.trim()) {
            console.error('Raw LLM response for', word, ':', response.content)
            response = await llm.generateCompletion({
                messages: [{ role: 'user', content: userPrompt + '\n\nIMPORTANT: Output ONLY the entry in the exact format, no extra text.' }],
                system: systemPrompt,
                temperature: 0.7,
                apiKey: req.user.useFreeModels ? undefined : req.user.llm_apikey,
                embedApiKey: req.user.useFreeModels ? undefined : req.user.embed_apikey
            });
            entry = parseGeneratedEntry(response.content, word);
        }
        if (!entry.definition || !entry.definition.trim()) {
            console.error('Retry also failed for', word, ':', response.content)
            throw new Error(`LLM returned an unparseable response for "${word}". Try again.`)
        }
        const quality = qualityChecker.assessQuality(entry);
        const evaluationResult = await evaluator.evaluateEntry(entry, word);
        entry.quality_score = quality.overall
        entry.validation_passed = evaluationResult?.isValid ?? false;
        const saved = await rag.addEntry(entry);
        await incrementGenCount(req.user)
        const lists = await vocabEngine.getMyLists(req.user.id);

        res.render('vocab/word', { user: req.user, entry: saved, error: null, isGenerated: true, lists })
    } catch (err) {
        console.error("Generation error", err)
        const recent = await rag.listRecent(10)
        res.render('vocab/index', { user: req.user, recent, error: err.message })
    }
})

router.get('/generate/:word', requireAuth, async (req, res) => {
    const word = req.params.word.toUpperCase();
    const existing = await rag.findByWord(word)
    if (!existing) {
        return res.render('vocab/index', { user: req.user, recent: await rag.listRecent(10), error: `No entry found for "${word}"` })
    }
    res.render('vocab/regenerate', { user: req.user, word, entry: existing, error: null })
})

router.post('/regenerate', requireAuth, checkAPIKeys, async (req, res) => {
    try {
        const { word, reason, specificIssue, improvements, partOfSpeech } = req.body
        const w = word.trim().toUpperCase()
        const negativeContent = `NEGATIVE FEEDBACK FOR ${w}:\nIssue: ${reason} — ${specificIssue}\nAvoid: ${improvements}`
        await supabase.from('rag_feedback_examples').insert({ word: w, type: "negative", content: negativeContent })
        const similar = await rag.retrieveSimilar(w, 3);
        const contextExamples = similar.map(s => `${s.word} — ${s.definition}`).join('\n');
        const systemPrompt = fs.readFileSync(path.join(__dirname, '../prompts/generate_vocab_entry.txt'), 'utf-8');
        const userPrompt = `Generate a vocabulary entry for "${w}".\nAvoid these issues from previous attempt:\n- ${reason}: ${specificIssue || improvements || 'improve quality'}\n\n${similar.length > 0 ? `Style reference:\n${contextExamples}\n` : ''}\nFollow the format exactly.`;

        let response = await llm.generateCompletion({
            messages: [{ role: 'user', content: userPrompt }],
            system: systemPrompt,
            temperature: 0.8,
            apiKey: req.user.useFreeModels ? undefined : req.user.llm_apikey
        });

        let entry = parseGeneratedEntry(response.content, w);
        if (!entry.definition || !entry.definition.trim()) {
            response = await llm.generateCompletion({
                messages: [{ role: 'user', content: userPrompt + '\n\nIMPORTANT: Output ONLY the entry in the exact format, no extra text.' }],
                system: systemPrompt,
                temperature: 0.7,
                apiKey: req.user.useFreeModels ? undefined : req.user.llm_apikey
            });
            entry = parseGeneratedEntry(response.content, w);
        }
        if (!entry.definition || !entry.definition.trim()) {
            throw new Error(`LLM returned an unparseable response for "${w}". Try again.`)
        }
        const quality = qualityChecker.assessQuality(entry);
        const evalResult = await evaluator.evaluateEntry(entry, w);
        entry.quality_score = quality.overall;
        entry.validation_passed = evalResult?.isValid ?? false;

        const saved = await rag.addEntry(entry);
        await incrementGenCount(req.user)
        if (req.body.satisfaction && parseInt(req.body.satisfaction) >= 7) {
            const positiveContent = `POSITIVE FEEDBACK FOR ${w}:\n${req.body.satisfaction}/10 Satisfied with the regenerated entry.`;
            await supabase.from('rag_feedback_examples').insert({ word: w, type: "positive", content: positiveContent })
        }
        const lists = await vocabEngine.getMyLists(req.user.id);
        res.render('vocab/word', { user: req.user, entry: saved, error: null, isRegenerated: true, lists })
    } catch (err) {
        res.render('vocab/index', { user: req.user, recent: await rag.listRecent(10), error: err.message })
    }
})

router.get('/lists', requireAuth, async (req, res) => {
    const [myLists, systemLists, publicLists, sharedLists] = await Promise.all([vocabEngine.getMyLists(req.user.id), vocabEngine.getSystemLists(), vocabEngine.getPublicLists(req.user.id), vocabEngine.getSharedWithMe(req.user.id)])
    res.render('vocab/lists', { user: req.user, myLists, systemLists, publicLists, sharedLists, error: null, tab: req.query.tab || 'mine' })
})

router.post('/lists', requireAuth, async (req, res) => {
    try {
        await vocabEngine.createList(req.user.id, req.body.name, req.body.description, req.body.visibility || "private")
        res.redirect('/vocab/lists')
    } catch (error) {
        const [myLists, systemLists, publicLists, sharedLists] = await Promise.all([vocabEngine.getMyLists(req.user.id), vocabEngine.getSystemLists(), vocabEngine.getPublicLists(req.user.id), vocabEngine.getSharedWithMe(req.user.id)])
        res.render('vocab/lists', { user: req.user, myLists, systemLists, publicLists, sharedLists, error: error.message, tab: 'mine' })
    }
})

router.post('/lists/:id/delete', requireAuth, async (req, res) => {
    try {
        await vocabEngine.deleteList(req.user.id, req.params.id)
        res.redirect('/vocab/lists')
    } catch (error) {
        const [myLists, systemLists, publicLists, sharedLists] = await Promise.all([vocabEngine.getMyLists(req.user.id), vocabEngine.getSystemLists(), vocabEngine.getPublicLists(req.user.id), vocabEngine.getSharedWithMe(req.user.id)])
        res.render('vocab/lists', { user: req.user, myLists, systemLists, publicLists, sharedLists, error: error.message, tab: 'mine' })
    }
})
router.get('/lists/:id', optionalAuth, async (req, res) => {
    try {
        const { list, words } = await vocabEngine.getList(req.params.id, req.user?.id);
        if (!list) return res.redirect('/vocab/lists');
        const isOwner = req.user && list.created_by === req.user.id;
        res.render('vocab/list', { user: req.user, list, words, isOwner, error: null });
    } catch (err) {
        res.redirect('/vocab/lists?error=' + encodeURIComponent(err.message));
    }
})

router.post('/lists/:id/add', requireAuth, async (req, res) => {
    try {
        await vocabEngine.addWordToList(req.params.id, req.body.wordId);
        res.redirect(req.headers.referer || `/vocab/lists/${req.params.id}`);
    } catch (err) {
        res.redirect(req.headers.referer || `/vocab/lists/${req.params.id}?error=` + encodeURIComponent(err.message));
    }
})

router.post('/lists/:id/remove/:wordId', requireAuth, async (req, res) => {
    try {
        await vocabEngine.removeWordFromList(req.params.id, req.params.wordId);
        res.redirect(`/vocab/lists/${req.params.id}`);
    } catch (err) {
        res.redirect(`/vocab/lists/${req.params.id}?error=` + encodeURIComponent(err.message));
    }
})

router.post('/lists/:id/visibility', requireAuth, async (req, res) => {
    try {
        await vocabEngine.changeVisibility(req.params.id, req.user.id, req.body.visibility);
        res.redirect(`/vocab/lists/${req.params.id}`);
    } catch (err) {
        res.redirect(`/vocab/lists/${req.params.id}?error=` + encodeURIComponent(err.message));
    }
})

router.post('/lists/:id/clone', requireAuth, async (req, res) => {
    try {
        await vocabEngine.cloneList(req.user.id, req.params.id);
        res.redirect(`/vocab/lists/${req.params.id}`);
    } catch (err) {
        res.redirect(`/vocab/lists/${req.params.id}?error=` + encodeURIComponent(err.message));
    }
})


router.get('/shared/:token', async (req, res) => {
    try {
        const result = await vocabEngine.getListByShareToken(req.params.token);
        if (!result) return res.status(404).render('error', { error: 'Invalid or expired share link', statusCode: 404 });
        res.render('vocab/list', {
            user: req.user || null,
            list: result.list,
            words: result.words,
            isOwner: req.user && result.list.created_by === req.user.id,
            error: null,
            sharedView: true
        })
    } catch (err) {
        res.status(500).render('error', { error: err.message, statusCode: 500 })
    }
})


router.post('/lists/:id/share-link', requireAuth, async (req, res) => {
    try {
        const token = await vocabEngine.generateShareLink(req.params.id, req.user.id);
        const shareUrl = `${req.protocol}://${req.get('host')}/vocab/shared/${token}`;
        res.json({ url: shareUrl, token });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
})

router.post('/lists/:id/share', requireAuth, async (req, res) => {
    try {
        await vocabEngine.shareList(req.params.id, req.user.id, req.body.email);
        res.redirect(`/vocab/lists/${req.params.id}`);
    } catch (err) {
        res.redirect(`/vocab/lists/${req.params.id}?error=${encodeURIComponent(err.message)}`);
    }
})

router.post('/lists/:id/share-link/toggle', requireAuth, async (req, res) => {
    try {
        await vocabEngine.toggleShareToken(req.params.id, req.user.id, req.body.enabled === 'true');
        res.redirect(`/vocab/lists/${req.params.id}`)
    } catch (errr) {
        res.redirect(`/vocab/lists/${req.params.id}?error=${encodeURIComponent(errr.message)}`)
    }
})
router.get('/lists/:id/export', requireAuth, async (req, res) => {
    try {
        const { list, words } = await vocabEngine.getList(req.params.id, req.user.id)
        if (!list) return res.redirect('/vocab/lists')
        const format = req.query.format || 'print'
        if (format === 'csv') {
            let csv = "Word,Pronunciation,Part of Speech,Definition,Example,Mnemonic Type,Mnemonic\n"
            for (const word of words) {
                csv += [
                    `"${(word.word || '').replace(/"/g, '""')}"`,
                    `"${(word.pronunciation || '').replace(/"/g, '""')}"`,
                    `"${(word.part_of_speech || '').replace(/"/g, '""')}"`,
                    `"${(word.definition || '').replace(/"/g, '""')}"`,
                    `"${(word.example_sentence || '').replace(/"/g, '""')}"`,
                    `"${(word.mnemonic_type || '').replace(/"/g, '""')}"`,
                    `"${(word.mnemonic_phrase || '').replace(/"/g, '""')}"`
                ].join(',')
                csv += '\n'
            }
            res.setHeader('Content-Type', 'text/csv')
            res.setHeader('Content-Disposition', `attachment; filename="${list.name.replace(/[^a-z0-9]/gi, '_')}.csv"`)
            return res.send(csv)
        }
        res.render('vocab/print', { layout:false, user: req.user, list, words })
    } catch (error) {
        console.error('Export error:', error)
        res.redirect('/vocab/lists')
    }
})

router.get('/:word', optionalAuth, async (req, res) => {
    const entry = await rag.findByWord(req.params.word.toUpperCase());
    if (!entry) {
        return res.render('vocab/index', { user: req.user, recent: await rag.listRecent(10), error: `No entry found for "${req.params.word}"` })
    }
    let lists = [];
    if (req.user) {
        lists = await vocabEngine.getMyLists(req.user.id);
    }
    res.render('vocab/word', { user: req.user, entry, lists, error: null })
});


module.exports = router;