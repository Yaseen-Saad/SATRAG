# AI Fixed — All Changes Made

## 1. `.env` — Embedding Provider
**Changed:** `EMBEDDING_BASE_URL` and `EMBEDDING_MODEL`
Old:
```
EMBEDDING_BASE_URL=https://opencode.ai/zen/v1
EMBEDDING_MODEL=big-pickle
```
New:
```
EMBEDDING_BASE_URL=https://fahmiaziz-api-embedding.hf.space/api/v1
EMBEDDING_MODEL=qwen3-0.6b
```
**Why:** OpenCode API doesn't support `/embeddings`. Switched to a free HF Space hosting qwen3-0.6b (1024-dim embeddings).

---

## 2. `src/config.js` — Embedding Defaults (lines 11-12)
**Changed:** Default env values
```js
EMBEDDING_BASE_URL: z.string().url().default('https://fahmiaziz-api-embedding.hf.space/api/v1'),
EMBEDDING_MODEL: z.string().default('qwen3-0.6b'),
```
**Why:** Matches .env changes so defaults work without explicit env vars.

---

## 3. `src/lib/llm.js` — Batch Embedding Method (lines 88-105)
**Added:** `generateEmbeddings(texts)` method
```js
async generateEmbeddings(texts) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.embedApiKey) {
        headers['Authorization'] = `Bearer ${this.embedApiKey}`;
    }
    const res = await fetch(`${this.embedBaseURL}/embeddings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: this.embedModel, input: texts })
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Error generating embeddings (LLM): ${res.status} - ${errorText}`);
    }
    const data = await res.json();
    return data.data.map(d => d.embedding);
}
```
**Why:** Supports batch embedding for seeder and batch-generate API.

---

## 4. `src/lib/rag.js` — listRecent Filtering (lines 96-111)
**Changed:** Now deduplicates by word and skips empty definitions
```js
async listRecent(limit = 10) {
    const { data } = await supabase.from('vocab_entries').select("*").order('created_at', { ascending: false }).limit(50)
    if (!data) return []
    const seen = new Set()
    const result = []
    for (const entry of data) {
        const w = entry.word?.toUpperCase()
        if (seen.has(w)) continue
        if (!entry.definition || !entry.definition.trim()) continue
        seen.add(w)
        result.push(entry)
        if (result.length >= limit) break
    }
    return result
}
```
**Why:** Prevents empty-definition entries and duplicates from appearing in recent list.

---

## 5. `src/lib/rag.js` — addEntry Fallback (line 84)
**Changed:** `embedding: []` → `embedding: null`
```js
const { data, error } = await supabase.from('vocab_entries').insert({ ...entry, embedding: null }).select().single();
```
**Why:** pgvector rejects empty arrays (`vector must have at least 1 dimension`). Null is valid.

---

## 6. `src/lib/qualityChecker.js` — Empty Entry Penalty (lines 21-28)
**Added:** Heavily penalize entries missing core components
```js
let overall = Object.entries(scores).reduce((acc, [key, value]) => acc + value * this.weights[key], 0);
if (!entry.definition || !entry.definition.trim()) overall = 0;
else if (!entry.mnemonic_phrase || !entry.mnemonic_phrase.trim()) overall *= 0.3;
else if (!entry.example_sentence || !entry.example_sentence.trim()) overall *= 0.5;
```
**Why:** Empty entries were getting ~5.1 quality score due to non-zero weighted averages.

---

## 7. `src/services/feedbackEngine.js` — Column Name Fix (lines 31-35)
**Changed:** `'satisfaction'` → `'satisfaction_score'` in `getAvgSatisfaction`
```js
async getAvgSatisfaction(wordId) {
    const { data } = await supabase.from('feedback_events')
        .select('satisfaction_score').eq('word_id', wordId)
    if (!data || data.length === 0) return null;
    const avg = data.reduce((sum, entry) => sum + (entry.satisfaction_score || 0), 0) / data.length;
    return Math.round(avg * 10) / 10;
}
```
**Why:** DB column is `satisfaction_score`, not `satisfaction`. Caused `PGRST204` errors.

---

## 8. `src/services/feedbackEngine.js` — Column Name Fix (line 79)
**Changed:** `'satisfaction'` → `'satisfaction_score'` in `getTopRated`
```js
const { data } = await supabase.from('feedback_events')
    .select('word_id, satisfaction_score').order('satisfaction_score', { ascending: false }).limit(limit)
```
**Why:** Same column name mismatch.

---

## 9. `src/services/feedbackEngine.js` — Anonymous Feedback (lines 4-13)
**Added:** Handle null userId for anonymous feedback submissions
```js
async recordFeedback({ userId, wordID, satisfaction, helpfulComponents, problematicComponents, comments }) {
    if (!userId) {
        const { data, error } = await supabase.from('feedback_events').insert({
            word_id: wordID,
            satisfaction,
            helpful_components: helpfulComponents || [],
            problematic_components: problematicComponents || [],
            comments
        }).select().single();
        if (error) {
            console.error(error)
            return null
        }
        return data
    }
```
**Why:** Feedback form on generated word page works without login.

---

## 10. `src/services/feedbackEngine.js` — Wire Feedback to RAG Examples (after original insert, lines ~30-43)
**Added:** Store positive/negative feedback also in `rag_feedback_examples` table
```js
try {
    const { data: wordEntry } = await supabase.from('vocab_entries').select('word').eq('id', wordID).single()
    if (wordEntry) {
        if (problematicComponents && problematicComponents.length > 0) {
            await supabase.from('rag_feedback_examples').insert({
                word: wordEntry.word,
                type: "negative",
                content: `NEGATIVE FEEDBACK FOR ${wordEntry.word}:\nIssues: ${problematicComponents.join(', ')}\nComments: ${comments || ''}`
            })
        }
        if (satisfaction >= 7) {
            await supabase.from('rag_feedback_examples').insert({
                word: wordEntry.word,
                type: "positive",
                content: `POSITIVE FEEDBACK FOR ${wordEntry.word}:\n${satisfaction}/10 Satisfied.\nHelpful: ${(helpfulComponents || []).join(', ')}`
            })
        }
    }
} catch (e) {
    // non-critical, don't fail the main operation
}
```
**Why:** General feedback was not being stored as RAG context examples.

---

## 11. `src/services/seeder.js` — Reduced Noise + Progress (entire file)
**Replaced** noisy `console.error` per entry with periodic progress log and summary
```js
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
```
**Why:** Original spammed `console.error` for every embedding failure. Now batches progress logs and reports final summary.

---

## 12. `src/routes/vocab.js` — response.content Fix (lines 51, 150)
**Changed:** `parseGeneratedEntry(response, word)` → `parseGeneratedEntry(response.content, word)`
```js
const entry = parseGeneratedEntry(response.content, word);
// Before: parseGeneratedEntry(response, word)
```
Also at line 150 (regenerate route).
**Why:** `generateCompletion()` returns an `LLMResponse` object, not a string. `.split is not a function` error.

---

## 13. `src/routes/vocab.js` — Empty Definition Validation (lines 53-55, 154-157)
**Added:** Throw error if parsed entry has empty definition
```js
if (!entry.definition || !entry.definition.trim()) {
    console.error('Raw LLM response for', word, ':', response.content)
    throw new Error(`LLM returned an unparseable response for "${word}". Try again.`)
}
```
**Why:** Prevents saving entries with blank definitions to the DB.

---

## 14. `src/routes/vocab.js` — Retry on Empty LLM Response (lines 45-56)
**Added:** Auto-retry once with stricter prompt when LLM returns empty
```js
let response = await llm.generateCompletion({...});
let entry = parseGeneratedEntry(response.content, word);
if (!entry.definition || !entry.definition.trim()) {
    response = await llm.generateCompletion({
        messages: [{ role: 'user', content: userPrompt + '\n\nIMPORTANT: Output ONLY the entry in the exact format, no extra text.' }],
        system: systemPrompt,
        temperature: 0.7,
    });
    entry = parseGeneratedEntry(response.content, word);
}
```
Also added to regenerate route.
**Why:** LLM (big-pickle) sometimes returns empty content on first try. One retry usually fixes it.

---

## 15. `src/routes/vocab.js` — isGenerated Flag (line 58)
**Changed:** Pass `isGenerated: true` to the word view
```js
res.render('vocab/word', { user: req.user, entry: saved, error: null, isGenerated: true })
```
**Why:** Tells the template to show the feedback/rating form.

---

## 16. `src/routes/vocab.js` — parseGeneratedEntry Rewrite (lines 71-158)
**Rewrote** entirely. New features:
- Strips markdown code blocks before parsing
- Tries 4 dash patterns (WORD (pron) pos — def, WORD (pron) — def, WORD pos — def, WORD — def)
- Falls back to finding any line with word + dash
- Falls back to any colon-separated line with short content
- Case-insensitive field matching (Sounds like / sounds like / Sounds Like)
- Handles non-string `text` input
**Why:** Original regex was too strict — any deviation in LLM output format meant empty parse.

---

## 17. `src/routes/feedback.js` — optionalAuth + Redirect (line 9)
**Changed:** `requireAuth` → `optionalAuth`
```js
router.post('/submit', optionalAuth, async (req, res) => { ... })
```
**Added:** Form POST redirect
```js
if (req.headers['content-type']?.includes('json')) {
    res.json({ success: true, data: result })
} else {
    res.redirect('/vocab')
}
```
**Why:** Feedback form on word page works without login. Redirects back to vocab after rating.

---

## 18. `src/routes/api.js` — New File (entire file)
**Created** `src/routes/api.js` with endpoints:
- `GET /api/health` — server status + entry count
- `GET /api/stats` — mnemonic type counts, POS counts, avg satisfaction
- `POST /api/batch-generate` — generate up to 20 words at once
- `POST /api/report` — report bad entries (stores in feedback_events + rag_feedback_examples)
- `GET /api/analytics` — user-scoped analytics (vocab stats, progress, quiz scores, feedback)
**Why:** API endpoints requested for monitoring and batch operations.

---

## 19. `src/routes/api.js` — parseGeneratedEntry (lines 94-134)
**Copied** the improved `parseGeneratedEntry` from `vocab.js` into `api.js`.
**Why:** `api.js` had the old strict regex version, same bug potential.

---

## 20. `src/views/vocab/word.ejs` — Feedback Form (lines 52-67)
**Added:** Satisfaction rating form after generation
```ejs
<% if (typeof isGenerated !== 'undefined' && isGenerated) { %>
<div class="entry-section" style="margin-top:1.5rem; background:#f3f4ff; border-left-color:#4caf50;">
    <div class="section-label">How was this entry?</div>
    <form action="/feedback/submit" method="POST" style="margin-top:0.5rem;">
      <input type="hidden" name="wordId" value="<%= entry.id %>">
      <div style="display:flex; gap:0.25rem; align-items:center; flex-wrap:wrap;">
        <% for (let i = 1; i <= 10; i++) { %>
        <label style="cursor:pointer; padding:0.25rem 0.5rem; border:1px solid #ccc; border-radius:4px; font-size:0.85rem;">
          <input type="radio" name="satisfaction" value="<%= i %>" <%= i === 7 ? 'checked' : '' %> style="margin:0;"> <%= i %>
        </label>
        <% } %>
      </div>
      <div style="margin-top:0.5rem; display:flex; gap:0.5rem;">
        <button type="submit" class="btn-primary" style="font-size:0.85rem;">Submit Rating</button>
      </div>
    </form>
</div>
<% } %>
```
**Why:** Positive feedback feature requested after word generation.

---

## 21. `src/index.js` — API Routes Registration (lines 18, 57)
**Added:** Import and mount API routes
```js
const apiRoutes = require('./routes/api');
// ...
app.use('/api', apiRoutes);
```
**Why:** Required for new API endpoints to work.

---

## 22. `supabase/migrations/03_vector_dim.sql` — New File
```sql
ALTER TABLE vocab_entries ALTER COLUMN embedding TYPE vector(1024);
```
**Updated** to `scripts/fix_all.sql` with safer `USING` clause and full setup.

---

## 23. `supabase/migrations/04_match_function.sql` — New File
**(Replaced by `scripts/fix_all.sql`)** — Initial attempt at `match_vocab_entries` with `RETURNS TABLE(...)`. Later replaced with `RETURNS SETOF vocab_entries` to avoid column type mismatch.

---

## 24. `scripts/apply_migrations.sql` — Created, then replaced
Initial SQL snippet for manual migration application. Superseded by `fix_all.sql`.

---

## 25. `scripts/fix_all.sql` — Complete Fix Script
**Created** with all database fixes:
```sql
-- 0. Make feedback_events.user_id nullable
ALTER TABLE feedback_events ALTER COLUMN user_id DROP NOT NULL;

-- 1. Drop old function
DROP FUNCTION IF EXISTS match_vocab_entries;

-- 2. Change vector dimension with USING
ALTER TABLE vocab_entries ALTER COLUMN embedding TYPE vector(1024) USING embedding::vector(1024);

-- 3. Create function with SETOF return type
CREATE FUNCTION match_vocab_entries(
    query_embedding vector(1024), match_threshold float, match_count int
)
RETURNS SETOF vocab_entries
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM vocab_entries
    WHERE 1 - (embedding <=> query_embedding) > match_threshold
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 4. RLS policies for all tables (SELECT + INSERT for everyone)
```
**Why:** Single script to fix: (a) broken function signature, (b) wrong vector dimension, (c) RLS blocking inserts, (d) nullable user_id for anonymous feedback.
