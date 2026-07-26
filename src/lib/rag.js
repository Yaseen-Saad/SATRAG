const { service: supabase } = require('./supabase')
const llm = require('./llm')
const fs = require("fs")
const path = require("path");
const evaluator = require('./SATQuestionsEvaluator');


function readFile(relativePath) {
    return fs.readFileSync(path.join(SAT_PROMPTS, relativePath), 'utf-8').trim()
}

const SAT_PROMPTS = path.join(__dirname, '../prompts/generate_sat_question_prompts')

const MAX_REGENERATION_ATTEMPTS = 3

const MATH_TOPIC_DIRS = {
    'Algebra': 'algebra',
    'Advanced Math': 'advanced_math',
    'Problem-Solving and Data Analysis': 'problem_solving',
    'Geometry and Trigonometry': 'geometry_trig'
}

const RW_TOPIC_DIRS = {
    'Craft and Structure': 'craft_and_structure',
    'Information and Ideas': 'information_and_ideas',
    'Standard English Conventions': 'standard_english',
    'Expression of Ideas': 'expression_of_ideas'
}

const SUBTOPIC_FILES = {
    // Math - Algebra
    'Linear equations in one variable': 'linear_equations_one_var.txt',
    'Linear equations in two variables': 'linear_equations_two_var.txt',
    'Linear functions': 'linear_functions.txt',
    'Systems of two linear equations in two variables': 'systems_linear.txt',
    'Linear inequalities in one or two variables': 'linear_inequalities.txt',
    // Math - Advanced Math
    'Equivalent expressions': 'equivalent_expressions.txt',
    'Nonlinear equations in one variable and systems of equations in two variables': 'nonlinear_equations.txt',
    'Nonlinear functions': 'nonlinear_functions.txt',
    // Math - Problem-Solving
    'Ratios, rates, proportional relationships, and units': 'ratios_rates.txt',
    'Percentages': 'percentages.txt',
    'One-variable data: distributions and measures of center and spread': 'one_variable_data.txt',
    'Two-variable data: models and scatterplots': 'two_variable_data.txt',
    'Probability and conditional probability': 'probability.txt',
    'Inference from sample statistics and margin of error': 'sample_statistics.txt',
    'Evaluating statistical claims: observational studies and experiments': 'statistical_claims.txt',
    // Math - Geometry & Trig
    'Area and volume': 'area_volume.txt',
    'Lines, angles, and triangles': 'lines_angles_triangles.txt',
    'Right triangles and trigonometry': 'right_triangles_trig.txt',
    'Circles': 'circles.txt',
    // Reading/Writing - Craft and Structure
    'Words in Context': 'words_in_context.txt',
    'Text Structure and Purpose': 'text_structure_purpose.txt',
    'Cross-Text Connections': 'cross_text_connections.txt',
    // Reading/Writing - Information and Ideas
    'Central Ideas and Details': 'centeral_ideas_details.txt',
    'Command of Evidence — Textual': 'command_of_evidence_textual.txt',
    'Command of Evidence — Quantitative': 'command_of_evidence_quantitative.txt',
    'Inferences': 'inferences.txt',
    // Reading/Writing - Standard English Conventions
    'Boundaries': 'boundaries.txt',
    'Form, Structure, and Sense': 'form_structure_sense.txt',
    // Reading/Writing - Expression of Ideas
    'Rhetorical Synthesis': 'rhetorical_synthesis.txt',
    'Transitions': 'transitions.txt'
}


class RAGEngine {
    // I want to use this function to get a random question (like till subptopic and diff) when the user do not provide any preferences, GENERALLY in all of this project I do not want the llm to guess which question it should generate, instead It MUST get the exact everything, if the user didn't specify a diff I will get a random one, if no subtopic get a random one and so on, but hte llm must have a speicifc thing to search for and the rag overall (lol why am i yapping) must retrive very simmilar questions to the one that will be generated
    getRandom(subject, topic, subtopic, difficulty) {
        if (subject && !topic && !subtopic) {
            return ["math", "reading_writing"][Math.floor(Math.random() * 2)]
        } if (!subject && topic && !subtopic) {
            return ["math", "reading_writing"][Math.floor(Math.random() * 2)]
        } if (topic == "subtopic") {

        }
    }
    buildPrompt(subject, topic, subtopic, difficulty) {
        const parts = [];
        parts.push(readFile('core.txt'));
        parts.push(readFile('general_rules.txt'));
        if (difficulty) {
            parts.push(readFile('difficulty.txt'));
        }
        const wantMath = !subject || subject === 'math'
        const wantRW = !subject || subject === 'reading' || subject === 'writing' || subject === 'reading_writing'

        if (wantMath) {
            parts.push(readFile('math/core.txt'))

            if (topic) {
                const topicDirName = MATH_TOPIC_DIRS[topic]
                if (topicDirName) {
                    if (subtopic) {
                        const subtopicFile = SUBTOPIC_FILES[subtopic]
                        if (subtopicFile) {
                            parts.push(readFile('math/' + topicDirName + '/' + subtopicFile));
                        }
                    } else {
                        const dirPath = path.join(SAT_PROMPTS, 'math', topicDirName)
                        const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.txt')).sort()
                        for (const file of files) {
                            parts.push(fs.readFileSync(path.join(dirPath, file), 'utf-8').trim())
                        }
                    }
                }
            } else {
                for (const dirName of Object.values(MATH_TOPIC_DIRS)) {
                    const dirPath = path.join(SAT_PROMPTS, 'math', dirName)
                    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.txt')).sort()
                    for (const file of files) {
                        parts.push(fs.readFileSync(path.join(dirPath, file), 'utf-8').trim())
                    }
                }
            }
        }
        if (wantRW) {
            parts.push(readFile('reading_writing/core.txt'))

            if (topic) {
                const topicDirName = RW_TOPIC_DIRS[topic]
                if (topicDirName) {
                    if (subtopic) {
                        const subtopicFile = SUBTOPIC_FILES[subtopic]
                        if (subtopicFile) {
                            parts.push(readFile('reading_writing/' + topicDirName + '/' + subtopicFile));
                        }
                    } else {
                        const dirPath = path.join(SAT_PROMPTS, 'reading_writing', topicDirName)
                        const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.txt')).sort()
                        for (const file of files) {
                            parts.push(fs.readFileSync(path.join(dirPath, file), 'utf-8').trim())
                        }
                    }
                }
            } else {
                for (const dirName of Object.values(RW_TOPIC_DIRS)) {
                    const dirPath = path.join(SAT_PROMPTS, 'reading_writing', dirName)
                    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.txt')).sort()
                    for (const file of files) {
                        parts.push(fs.readFileSync(path.join(dirPath, file), 'utf-8').trim())
                    }
                }
            }
        }
        const result = parts.join("\n\n")
        return result
    }

    async retrieveSimilar(word, topK = 3) {
        try {
            const embedding = await llm.generateEmbedding(word);
            const { data: similar, error } = await supabase.rpc('match_vocab_entries', {
                query_embedding: embedding,
                match_threshold: 0.5,
                match_count: topK
            });
            if (error) throw error;
            if (similar && similar.length > 0) return similar;
            throw new Error('No vector matches found');
        } catch (err) {
            console.error("Embedding search failed, using keyword fallback:", err.message);
            return this.keywordSearch(word, topK);
        }
    }

    async keywordSearch(word, topK) {
        try {
            const { data: all } = await supabase
                .from('vocab_entries')
                .select('*')
                .limit(200);
            if (!all || all.length === 0) return [];

            const w = word.toLowerCase();
            const scored = all.map(e => {
                let score = 0;
                const ew = (e.word || '').toLowerCase();
                const ed = (e.definition || '').toLowerCase();
                const es = (e.example_sentence || '').toLowerCase();
                if (ew === w) score += 10;
                else if (ew.includes(w) || w.includes(ew)) score += 5;
                if (ed.includes(w)) score += 3;
                if (es.includes(w)) score += 1;
                return { ...e, similarity: score };
            }).filter(e => e.similarity > 0).sort((a, b) => b.similarity - a.similarity).slice(0, topK);

            if (scored.length > 0) return scored;
            const { data } = await supabase
                .from('vocab_entries')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(topK);
            return data || [];
        } catch (fallbackErr) {
            console.error('Keyword search fallback failed:', fallbackErr.message);
            const { data } = await supabase.from('vocab_entries')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(topK);
            return data || [];
        }
    }

    async getFeedbackContext(word) {
        const { data: wordEntry } = await supabase
            .from('vocab_entries')
            .select('id')
            .eq('word', word.toUpperCase())
            .limit(1)
            .single();
        if (!wordEntry) return [];
        const { data: feedback } = await supabase
            .from("feedback_events")
            .select('satisfaction_score, helpful_components, problematic_components, comments')
            .eq('word_id', wordEntry.id)
            .order('created_at', { ascending: false })
            .limit(5)
        return feedback || []
    }

    async getFeedbackPatterns() {
        const { data: negatives } = await supabase
            .from('rag_feedback_examples')
            .select('content')
            .eq('type', 'negative')
            .order('created_at', { ascending: false })
            .limit(20)
        const { data: positives } = await supabase
            .from('rag_feedback_examples')
            .select('content')
            .eq('type', 'positive')
            .order('created_at', { ascending: false })
            .limit(20)

        const patterns = { issues: [], strengths: [] }
        if (negatives && negatives.length > 0) {
            const issueLines = negatives.map(n => n.content).join('\n')
            const commonIssues = []
            const issueMap = { 'mnemonic': 0, 'picture': 0, 'definition': 0, 'sentence': 0, 'boring': 0, 'confusing': 0, 'incorrect': 0, 'short': 0, 'long': 0 }
            for (const key of Object.keys(issueMap)) {
                const count = (issueLines.toLowerCase().match(new RegExp(key, 'g')) || []).length
                if (count >= 2) issueMap[key] = count
            }
            for (const [issue, count] of Object.entries(issueMap)) {
                if (count >= 2) commonIssues.push(`${issue} (mentioned ${count} times)`)
            }
            patterns.issues = commonIssues.slice(0, 5)
        }
        if (positives && positives.length > 0) {
            const posLines = positives.map(p => p.content).join('\n')
            const strengths = []
            const strengthMap = { 'mnemonic': 0, 'picture': 0, 'sentence': 0, 'creative': 0, 'memorable': 0, 'vivid': 0 }
            for (const key of Object.keys(strengthMap)) {
                const count = (posLines.toLowerCase().match(new RegExp(key, 'g')) || []).length
                if (count >= 2) strengthMap[key] = count
            }
            for (const [strength, count] of Object.entries(strengthMap)) {
                if (count >= 2) strengths.push(`${strength} (praised ${count} times)`)
            }
            patterns.strengths = strengths.slice(0, 5)
        }
        return patterns
    }

    async addEntry(entry) {
        try {
            const embedding = await llm.generateEmbedding(`${entry.word} ${entry.definition} ${entry.example_sentence}`);
            const { data, error } = await supabase.from('vocab_entries').insert({ ...entry, embedding }).select().single();
            if (error) throw error;
            return data;
        } catch (err) {
            console.error("Embedding generation failed, inserting without embedding:", err.message);
            const { data, error } = await supabase.from('vocab_entries').insert({ ...entry, embedding: null }).select().single();
            if (error) throw error;
            return data;
        }
    }

    async findByWord(word) {
        const { data } = await supabase.from('vocab_entries')
            .select("*").ilike('word', word).limit(1).single();
        return data;
    }

    async listRecent(limit = 10) {
        const { data } = await supabase.from('vocab_entries')
            .select("*")
            .order('created_at', { ascending: false }).limit(limit)
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

    async findSATExamples({ subject, topic, subtopic, difficulty, count = 5 }) {
        const limit = count + 6;

        const isRW = subject === 'reading' || subject === 'writing' || subject === 'reading_writing';
        const querySubject = subject === 'reading_writing' ? null : subject;
        const querySubtopic = subtopic && subtopic.startsWith('Command of Evidence') ? 'Command of Evidence' : subtopic;

        let candidates = [];
        try {
            const queryText = [querySubtopic, topic, subject, difficulty].filter(Boolean).join(' ')
            const embedding = await llm.generateEmbedding(queryText)
            const { data } = await supabase.rpc('match_sat_questions', {
                query_embedding: embedding,
                match_subject: querySubject || null,
                match_topic: topic || null,
                match_difficulty: difficulty || null,
                match_threshold: 0.3,
                match_count: limit
            })
            if (data && data.length) candidates = data
        } catch (e) {
            console.error('Embedding search failed:', e.message)
        }
        if (candidates.length < count) {
            async function tryQuery(filters) {
                let q = supabase.from('sat_questions').select('*').eq('source', 'collegeboard').eq('is_active', true);
                if (filters.subject) {
                    if (isRW) q = q.in('subject', ['reading', 'writing']);
                    else q = q.eq('subject', filters.subject);
                }
                if (filters.topic) q = q.eq('topic', filters.topic);
                if (filters.subtopic) q = q.eq('subtopic', filters.subtopic);
                if (filters.difficulty) q = q.eq('difficulty', filters.difficulty);
                const { data } = await q.limit(limit);
                return data || [];
            }
            let metaResults = [];
            if (querySubtopic) metaResults = await tryQuery({ subject, topic, subtopic: querySubtopic, difficulty });
            if (metaResults.length < 2 && querySubtopic) metaResults = await tryQuery({ subject, topic, subtopic: querySubtopic });
            if (metaResults.length < 2) metaResults = await tryQuery({ subject, topic });
            if (metaResults.length < 2) metaResults = await tryQuery({ subject });
            if (metaResults.length < 2) metaResults = await tryQuery({});
            const existingIds = new Set(candidates.map(c => c.id));
            for (const r of metaResults) {
                if (!existingIds.has(r.id)) candidates.push(r);
            }
        }
        return candidates.slice(0, count);
    }

    async generateSATQuestion({ subject, topic, subtopic, difficulty, apiKey, embedApiKey, userId }) {
        let bestQuestion = null
        let bestScore = -1
        for (let attempt = 1; attempt <= MAX_REGENERATION_ATTEMPTS; attempt++) {
            try {
                const examples = await this.findSATExamples({ subject, topic, subtopic, difficulty, count: 4 })
                const prompt = this.buildPrompt(subject, topic, subtopic, difficulty)
                const messages = [{ role: 'system', content: prompt }, ...examples.map((ex, i) => {
                    let opts
                    try { opts = typeof ex.options === 'string' ? JSON.parse(ex.options) : ex.options } catch (e) { }
                    return {
                        role: 'user', content: `Example ${i + 1}:\n${JSON.stringify({
                            question_type: ex.question_type,
                            passage_text: (ex.passage_text || '').substring(0, 600) || null,
                            question_text: (ex.question_text || '').substring(0, 500),
                            options: opts, correct_answer: ex.correct_answer,
                            explanation: (ex.explanation || '').substring(0, 400),
                            subject: ex.subject, topic: ex.topic,
                            subtopic: ex.subtopic || ex.skill_description,
                            difficulty: ex.difficulty, difficulty_band: ex.difficulty_band
                        }, null, 2)}`
                    }
                })]
                let instruction = `Generate 1 new SAT question in JSON format.\n\nSubject: ${subject || 'any'}\nTopic: ${topic || 'any'}\nSubtopic/Skill: ${subtopic || 'any'}\nDifficulty: ${difficulty || 'any'}\n\nIMPORTANT:\n- Match the difficulty of the examples shown above.\n- If difficulty is "hard", the question must be genuinely challenging (difficulty_band 6-7).\n- If difficulty is "easy", the question must be straightforward (difficulty_band 1-2).\n- For Reading/Writing blanks, use <u>word</u> format, NOT underscores.\n- NO MARKDOWN. Output ONLY the single JSON object.\n- Make distractors plausible — they should test real common mistakes.\n- The correct answer must be unambiguously correct.`
                if (attempt > 1 && bestQuestion && bestQuestion._evaluationFeedback) {
                    instruction += `\n\nPREVIOUS ATTEMPT HAD ISSUES:\n${bestQuestion._evaluationFeedback}\n\nFix these issues in your new question.`
                }

                messages.push({ role: 'user', content: instruction })
                const response = await llm.generateCompletion({
                    userId,
                    messages, temperature: 0.4, maxTokens: 8000,
                    apiKey, embedApiKey, skipCache: true
                })
                if (!response.success || !response.content) {
                    console.error(`Attempt ${attempt}: LLM returned no content:`, response.error || 'empty')
                    continue
                }
                let raw = response.content.replace(/```json/g, '').replace(/```/g, '').trim()
                if (response.finishReason === 'length') {
                    const openBraces = (raw.match(/{/g) || []).length
                    const closeBraces = (raw.match(/}/g) || []).length
                    const openBrackets = (raw.match(/\[/g) || []).length
                    const closeBrackets = (raw.match(/]/g) || []).length
                    raw = raw.replace(/,\s*"[^"]*$/, '')
                    for (let i = 0; i < openBrackets - closeBrackets; i++) raw += ']'
                    for (let i = 0; i < openBraces - closeBraces; i++) raw += '}'
                    console.warn(`Attempt ${attempt}: LLM response truncated, salvaged JSON`)
                }

                const match = raw.match(/\{[\s\S]*\}/)
                if (!match) {
                    console.error(`Attempt ${attempt}: No JSON in response`)
                    continue
                }

                const result = JSON.parse(match[0].trim())
                if (result.question_text) {
                    result.question_text = result.question_text.replace(/_{2,}\s*(?:blank)?\s*/gi, '<span style="text-decoration: underline;"> </span>')
                }
                let opts = result.options
                if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
                    opts = Object.entries(opts).map(([label, content]) => ({ label, content }))
                }
                const question = { ...result, options: opts ? JSON.stringify(opts) : null }

                const evaluation = await evaluator.evaluate(question, apiKey, embedApiKey, userId)
                console.log(`Attempt ${attempt}: score=${evaluation.overallScore} format_valid=${evaluation.scores?.format_valid} feedback: ${evaluation.feedback}`)

                const formatOK = evaluation.scores?.format_valid !== false
                const combinedScore = evaluation.overallScore * (formatOK ? 1 : 0.5)

                if (combinedScore > bestScore) {
                    bestScore = combinedScore
                    bestQuestion = {
                        ...question,
                        _overallScore: evaluation.overallScore,
                        _evaluationFeedback: evaluation.criticalIssues.length > 0
                            ? evaluation.criticalIssues.join('; ')
                            : evaluation.suggestions.join('; ')
                    }
                }

                if (evaluation.overallScore >= 0.80 && evaluation.scores?.correctness >= 0.9 && formatOK) {
                    break
                }
                if (evaluation.revisedQuestion) {
                    bestQuestion = {
                        ...evaluation.revisedQuestion,
                        options: typeof evaluation.revisedQuestion.options === 'object'
                            ? JSON.stringify(evaluation.revisedQuestion.options)
                            : evaluation.revisedQuestion.options,
                        _evaluationScore: evaluation.overallScore,
                        _evaluationFeedback: null
                    }
                    break
                }
            } catch (error) {
                console.error(`Attempt ${attempt} error:`, error.message)
            }
        }

        if (!bestQuestion) {
            throw new Error('Failed to generate a valid question after all attempts')
        }

        return {
            ...bestQuestion,
            source: 'ai_generated',
            is_active: false,
            tags: JSON.stringify([bestQuestion.skill_code || '', bestQuestion.subject])
        }
    }

    async saveGeneratedQuestion(question, userId) {
        const text = question.stem_plain_text || question.question_text || ""
        const embedding = text ? await llm.generateEmbedding(text) : null
        const clean = {}
        for (const [k, v] of Object.entries(question)) {
            if (k.startsWith('_')) continue
            clean[k] = v
        }
        if (clean.subtopic && clean.subtopic.startsWith('Command of Evidence')) {
            clean.subtopic = 'Command of Evidence'
        }
        clean.created_by = userId || null
        const { data, error } = await supabase.from('sat_questions').insert({ ...clean, embedding }).select().single();
        if (error) throw error;
        return data;
    }
}

module.exports = new RAGEngine()