const { Router } = require('express')
const { requireAuth } = require('../middleware/auth')
const flashcardsEngine = require('../services/flashcardsEngine')
const vocabEngine = require('../services/vocabEngine')

const router = Router()

router.get('/', requireAuth, async (req, res) => {
    try {
        const [stats, dueCounts, lists] = await Promise.all([
            flashcardsEngine.getStats(req.user.id),
            flashcardsEngine.getListDueCounts(req.user.id),
            vocabEngine.getMyLists(req.user.id)
        ])
        res.render('flashcards/index', { user: req.user, stats, listDueCounts: dueCounts, lists, error: null })
    } catch (error) {
        console.error('Flashcards overview error:', error)
        res.render('flashcards/index', { user: req.user, stats: { totalCards: 0, dueToday: 0, mastered: 0, totalLists: 0 }, listDueCounts: [], lists: [], error: 'Error loading flashcards overview' })
    }
})

router.get('/session', requireAuth, async (req, res) => {
    try {
        const { listId, wordId } = req.query
        if (!listId && !wordId) return res.redirect('/flashcards')
        let listName = 'Flashcard Practice'
        if (listId) {
            const list = await vocabEngine.getList(listId, req.user.id)
            if (list) listName = list.name || listName
        }
        const cards = await flashcardsEngine.getSessionCards(req.user.id, { listId, wordId })
        res.render('flashcards/session', { user: req.user, cards, listName, listId, wordId, error: null })

    } catch (error) {
        console.error('Flashcards session error:', error)
        res.redirect('/flashcards?error=Error loading flashcards session')
    }
})

router.post('/review', requireAuth, async (req, res) => {
    try {
        const { wordId, quality } = req.body
        if (!wordId || quality == null) return res.status(400).json({ error: "Missing wordId or quality" })
        const q = parseInt(quality, 10)
        if (![0, 2, 3, 5].includes(q)) return res.status(400).json({ error: "Invalid quality value" })
        await flashcardsEngine.submitReview(req.user.id, wordId, q)
        res.json({ success: true })
    } catch (error) {
        console.error('Review error', error)
        res.status(500).json({ error: error.message })
    }
})

router.post('/list/:id/start', requireAuth, async function (req, res) {
    try {
        const list = await vocabEngine.getList(req.params.id, req.user.id)
        if (!list) return res.status(404).render('error', { error: 'List not found', statusCode: 404 })
        res.redirect(`/flashcards/session?listId=${req.params.id}`)
    } catch (error) {
        console.error('Start flashcards session error:', error)
        res.redirect('/flashcards?error=Error starting flashcards session')
    }
})

router.post('/word/:id/add', requireAuth, async function (req, res) {
    try {
        await flashcardsEngine.ensureWordInitialized(req.user.id, req.params.id);
        res.json({ success: true })
    } catch (error) {
        console.error('Add word error:', error)
        res.status(500).json({ error: error.message })
    }
})

router.post('/word/:id/remove', requireAuth, async function (req, res) {
    try {
        await flashcardsEngine.removeWord(req.user.id, req.params.id);
        res.json({ success: true })
    } catch (error) {
        console.error('Remove word error:', error)
        res.status(500).json({ error: error.message })
    }
})

router.get('/export/anki', requireAuth, async (req, res) => {
    try {
        const data = await flashcardsEngine.exportAnki(req.user.id)
        if (!data.length) return res.redirect('/flashcards?error=No flashcards available for export')
        const headers = Object.keys(data[0])
        const csv = [headers.join(',')].concat(data.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))).join('\n');
        data.forEach(row => {
            csv.push(headers.map(h => {
                const val = (row[h] || "").toString().replace(/"/g, '""');
                return val.includes(",") || val.includes('"') ? '"' + val + '"' : val;
            }).join(","))
        })
        res.setHeader("Content-Type", 'text/csv');
        res.setHeader("Content-Disposition", "attachment; filename=flashcards.csv");
        res.send(csv.join("\n"));
    } catch (error) {
        console.error('Export Anki error:', error)
        res.status(500).json({ error: error.message })
    }
})
router.post('/import/anki', requireAuth, async (req, res) => {
    try {
        const { text } = req.body
        if (!text || !text.trim()) return res.redirect('/flashcards?error=Paste some words or CSV data')
        const lines = text.trim().split('\n').filter(Boolean)
        const firstLine = lines[0].toLowerCase()
        let entries;
        if (firstLine.includes('word') || firstLine.includes('definition') || firstLine.includes(',')) {
            const headers = lines[0].split(',').map(h => h.trim());
            entries = lines.slice(1).map(line => {
                const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
                const obj = {}
                headers.forEach((h, i) => obj[h] = vals[i] || '')
                return obj;
            });
        } else {
            entries = lines.map(w => ({ word: w.trim() }));
        }
        const created = await flashcardsEngine.importAnki(req.user.id, entries);
        res.redirect('/flashcards?success=Imported ' + created.length + ' words into flashcards');
    } catch (err) {
        res.redirect('/flashcards?error=' + encodeURIComponent(err.message));
    }
});
module.exports = router