const { Router } = require('express')
const path = require('path')
const fs = require('fs')
const supabase = require('../lib/supabase')
const llm = require('../lib/llm')
const rag = require('../lib/rag')
const qualityChecker = require('../lib/qualityChecker')
const evaluator = require('../lib/vocabularyEvaluator')
const { requireAuth, optionalAuth } = require('../middleware/auth')

const router = Router()

// GET /api/health
router.get('/health', async (req, res) => {
    try {
        const { count } = await supabase.from('vocab_entries').select('*', { count: 'exact', head: true })
        res.json({ status: 'ok', entries: count, timestamp: new Date().toISOString() })
    } catch (err) {
        res.status(503).json({ status: 'error', message: err.message })
    }
})

// GET /api/stats
router.get('/stats', async (req, res) => {
    try {
        const { count: totalEntries } = await supabase.from('vocab_entries').select('*', { count: 'exact', head: true })
        const { data: mnemonicTypes } = await supabase.from('vocab_entries').select('mnemonic_type')
        const { data: posData } = await supabase.from('vocab_entries').select('part_of_speech')
        const { data: feedbackData } = await supabase.from('feedback_events').select('satisfaction_score')

        const mnemonicCounts = {}
        for (const row of mnemonicTypes || []) {
            const t = row.mnemonic_type || 'unknown'
            mnemonicCounts[t] = (mnemonicCounts[t] || 0) + 1
        }

        const posCounts = {}
        for (const row of posData || []) {
            const p = row.part_of_speech || 'unknown'
            posCounts[p] = (posCounts[p] || 0) + 1
        }

        const avgSatisfaction = (feedbackData || []).length > 0
            ? (feedbackData.reduce((s, f) => s + (f.satisfaction_score || 0), 0) / feedbackData.length).toFixed(2)
            : null

        res.json({ totalEntries, mnemonicCounts, posCounts, totalFeedback: (feedbackData || []).length, avgSatisfaction })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// POST /api/batch-generate
router.post('/batch-generate', optionalAuth, async (req, res) => {
    const { words } = req.body
    if (!words || !Array.isArray(words) || words.length === 0) {
        return res.status(400).json({ error: 'Provide an array of words.' })
    }
    if (words.length > 20) {
        return res.status(400).json({ error: 'Maximum 20 words per batch.' })
    }
    const results = []
    for (const word of words) {
        try {
            const w = word.trim().toUpperCase()
            const existing = await rag.findByWord(w)
            if (existing) {
                results.push({ word: w, status: 'exists', entry: existing })
                continue
            }
            const similar = await rag.retrieveSimilar(w, 3)
            const contextExamples = similar.map(s => `${s.word} — ${s.definition}`).join('\n')
            const systemPrompt = fs.readFileSync(path.join(__dirname, '../prompts/generate_vocab_entry.txt'), 'utf-8')
            const userPrompt = `Generate a vocabulary entry for "${w}".\n${similar.length > 0 ? `Style reference:\n${contextExamples}\n` : ''}\nFollow the format exactly.`
            const response = await llm.generateCompletion({
                messages: [{ role: 'user', content: userPrompt }],
                system: systemPrompt,
                temperature: 0.8,
            })
            const entry = parseGeneratedEntry(response.content, w)
            const quality = qualityChecker.assessQuality(entry)
            const evalResult = evaluator.evaluateEntry(entry, w)
            entry.quality_score = quality.overall
            entry.validation_passed = evalResult.isValid
            const saved = await rag.addEntry(entry)
            results.push({ word: w, status: 'created', entry: saved })
        } catch (err) {
            results.push({ word: word.trim().toUpperCase(), status: 'error', error: err.message })
        }
    }
    res.json({ results })
})

function parseGeneratedEntry(text, word) {
    if (typeof text !== 'string') {
        text = String(text || '')
    }
    text = text.replace(/```[\s\S]*?```/g, '')
    const lines = text.split('\n').map(l => l.trim()).filter(l => l)
    const entry = {
        word, pronunciation: '', part_of_speech: '', definition: '',
        mnemonic_type: '', mnemonic_phrase: '', picture_story: '',
        other_forms: '', example_sentence: '', source: 'generated',
        validation_passed: true, quality_score: 7.0,
    }
    const dashPatterns = [
        /^[\w-]+\s+\(([^)]+)\)\s+([\w.]+)\s*—+\s*(.+)/,
        /^[\w-]+\s+\(([^)]+)\)\s*—+\s*(.+)/,
        /^[\w-]+\s+([\w.]+)\s*—+\s*(.+)/,
        /^[\w-]+\s*—+\s*(.+)/,
    ]
    for (const line of lines) {
        for (const pattern of dashPatterns) {
            const m = line?.match(pattern)
            if (m) {
                if (m[1] && m[2] && m[3]) {
                    entry.pronunciation = m[1]
                    entry.part_of_speech = m[2].replace(/\.$/, '')
                    entry.definition = m[3]
                } else if (m[1] && m[2]) {
                    if (m[1].includes('-')) { entry.pronunciation = m[1]; entry.definition = m[2] }
                    else { entry.part_of_speech = m[1].replace(/\.$/, ''); entry.definition = m[2] }
                }
                break
            }
        }
        if (entry.definition) break
    }
    if (!entry.definition) {
        const wl = word.toLowerCase()
        for (const line of lines) {
            if (line.toLowerCase().includes(wl) && /\s*—+\s*/.test(line)) {
                const parts = line.split(/\s*—+\s*/)
                if (parts.length >= 2) {
                    entry.definition = parts.slice(1).join(' — ').trim()
                    break
                }
            }
        }
    }
    if (!entry.definition) {
        for (const line of lines) {
            const colonIdx = line.indexOf(':')
            if (colonIdx > 0 && !/^(sounds?|picture|other|sentence)/i.test(line)) {
                const after = line.slice(colonIdx + 1).trim()
                if (after && after.split(' ').length <= 20) {
                    entry.definition = after
                    break
                }
            }
        }
    }
    let currentField = null
    for (const line of lines) {
        const fl = line.toLowerCase()
        if (/^sounds?\s+like:/.test(fl)) {
            entry.mnemonic_type = 'sounds-like'
            entry.mnemonic_phrase = line.replace(/^Sounds?\s+like:\s*/i, '').trim()
            currentField = null
        } else if (/^picture:/.test(fl)) {
            entry.picture_story = line.replace(/^Picture:\s*/i, '').trim()
            currentField = 'picture_story'
        } else if (/^other\s+forms:/.test(fl)) {
            entry.other_forms = line.replace(/^Other\s+forms:\s*/i, '').trim()
            currentField = 'other_forms'
        } else if (/^sentence:/.test(fl)) {
            entry.example_sentence = line.replace(/^Sentence:\s*/i, '').trim()
            currentField = 'example_sentence'
        } else if (currentField && line && !line.match(/^[A-Z][a-z]/)) {
            entry[currentField] += ' ' + line
        }
    }
    if (entry.example_sentence && !entry.example_sentence.toLowerCase().includes(word.toLowerCase())) {
        entry.validation_passed = false
    }
    return entry
}

// POST /api/report
router.post('/report', requireAuth, async (req, res) => {
    try {
        const { word, issue, details, satisfaction } = req.body
        if (!word) return res.status(400).json({ error: 'Word is required.' })

        const w = word.trim().toUpperCase()
        const wordEntry = await rag.findByWord(w)
        if (!wordEntry) return res.status(404).json({ error: `No entry found for "${w}"` })

        if (issue || details) {
            const negativeContent = `NEGATIVE FEEDBACK FOR ${w}:\nIssue: ${issue || 'unspecified'}\nDetails: ${details || ''}`
            await supabase.from('rag_feedback_examples').insert({ word: w, type: "negative", content: negativeContent })
        }

        if (satisfaction && parseInt(satisfaction) >= 7) {
            const positiveContent = `POSITIVE FEEDBACK FOR ${w}:\n${satisfaction}/10 Satisfied.`
            await supabase.from('rag_feedback_examples').insert({ word: w, type: "positive", content: positiveContent })
        }

        const { error: fbError } = await supabase.from('feedback_events').insert({
            word_id: wordEntry.id,
            user_id: req.user.id,
            satisfaction_score: satisfaction ? parseInt(satisfaction) : null,
            problematic_components: issue ? [issue] : [],
            comments: details || '',
        })
        if (fbError) throw fbError

        res.json({ status: 'ok', message: 'Report recorded.' })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// GET /api/analytics
router.get('/analytics', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id

        const { data: entries } = await supabase.from('vocab_entries').select('*').order('created_at', { ascending: false })
        const { data: feedback } = await supabase.from('feedback_events').select('*, vocab_entries!inner(word)').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
        const { data: quizzes } = await supabase.from('quiz_attempts').select('*').eq('user_id', userId).order('attempt_time', { ascending: false })
        const { data: progress } = await supabase.from('user_vocab_progress').select('*, vocab_entries!inner(word, definition)').eq('user_id', userId)

        const totalEntries = entries?.length || 0
        const validatedEntries = entries?.filter(e => e.validation_passed).length || 0
        const avgQuality = entries?.length > 0 ? (entries.reduce((s, e) => s + (e.quality_score || 0), 0) / entries.length).toFixed(2) : 0
        const sourceCounts = {}
        for (const e of entries || []) {
            const src = e.source || 'unknown'
            sourceCounts[src] = (sourceCounts[src] || 0) + 1
        }

        const wordCount = progress?.length || 0
        const avgFamiliarity = progress?.length > 0 ? (progress.reduce((s, p) => s + (p.familiarity || 0), 0) / progress.length).toFixed(2) : 0
        const dueReviews = progress?.filter(p => p.next_review && new Date(p.next_review) <= new Date()).length || 0

        const quizCount = quizzes?.length || 0
        const avgScore = quizzes?.length > 0 ? (quizzes.reduce((s, q) => s + (q.total_questions > 0 ? (q.score / q.total_questions) * 100 : 0), 0) / quizzes.length).toFixed(2) : 0

        const avgSatisfaction = feedback?.length > 0 ? (feedback.reduce((s, f) => s + (f.satisfaction_score || 0), 0) / feedback.length).toFixed(2) : 0

        res.json({
            vocab: { totalEntries, validatedEntries, avgQuality, sourceCounts },
            progress: { wordCount, avgFamiliarity, dueReviews },
            quizzes: { quizCount, avgScore },
            feedback: { total: feedback?.length || 0, avgSatisfaction },
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

module.exports = router
