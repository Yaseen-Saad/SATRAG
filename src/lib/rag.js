const { service: supabase } = require('./supabase')
const llm = require('./llm')
const fs = require("fs")
const path = require("path")

const SAT_QUESTION_PROMPT = require('fs').readFileSync(require('path').join(__dirname, '../prompts/generate_sat_question_prompts/generate_sat_question.txt'), 'utf-8');
const SAT_PROMPTS = path.join(__dirname, '../prompts/generate_sat_question_prompts')

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

function readFile(relativePath) {
    return fs.readFileSync(path.join(SAT_PROMPTS, relativePath), 'utf-8').trim()
}

class RAGEngine {
    //This needs work
    getRandom(subject, topic, subtopic) {
        if (subject && !topic && !subtopic) {
            return ["math", "reading_writing"][Math.floor(Math.random() * 2)]
        } if (!subject && topic && !subtopic) {
            return ["math", "reading_writing"][Math.floor(Math.random() * 2)]
        } if (topic == "subtopic") {

        }
    }
    buildPrompt(subject, topic, subtopic) {
        const parts = [];
        parts.push(readFile('core.txt'));
        parts.push(readFile('difficulty.txt'));
        parts.push(readFile('general_rules.txt'));
        const wantMath = !subject || subject === 'math'
        const wantRW = !subject || isRW(subject)

        if (wantMath) {
            parts.push(readFile('math/core.txt'))

            if (topic) {
                const topicDirName = MATH_TOPIC_DIRS[topic]
                if (topicDirName) {
                    if (subtopic) {
                        const dirPath = path.join(SAT_PROMPTS, 'math/' + topicDirName, SUBTOPIC_FILES[subtopic])
                        parts.push(readFile(dirPath));
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
                        const dirPath = path.join(SAT_PROMPTS, 'reading_writing/' + topicDirName, SUBTOPIC_FILES[subtopic])
                        parts.push(readFile(dirPath));
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
        return result || SAT_QUESTION_PROMPT
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
        const limit = count + 3;

        async function tryQuery(filters) {
            let q = supabase.from('sat_questions').select('*').eq('source', 'collegeboard');
            if (filters.subject) q = q.eq('subject', filters.subject);
            if (filters.topic) q = q.eq('topic', filters.topic);
            if (filters.subtopic) q = q.eq('subtopic', filters.subtopic);
            if (filters.difficulty) q = q.eq('difficulty', filters.difficulty);
            const { data } = await q.limit(limit);
            return data || [];
        }

        let results = await tryQuery({ subject, topic, subtopic, difficulty });
        if (results.length < 2) results = await tryQuery({ subject, topic, subtopic });
        if (results.length < 2) results = await tryQuery({ subject, topic });
        if (results.length < 2) results = await tryQuery({ subject });
        if (results.length < 2) results = await tryQuery({});

        const shuffled = results.length <= 1 ? [...results] : results.map((v, i) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([_, v]) => v);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }

    async generateSATQuestion({ subject, topic, subtopic, difficulty, apiKey, embedApiKey }) {
        const examples = await this.findSATExamples({ subject, topic, subtopic, difficulty, count: 4 });
        const prompt = buildPrompt(subject, topic, subtopic)
        const messages = [{ role: 'system', content: prompt }, ...examples.map((ex, i) => {
            let opts;
            try {
                opts = typeof ex.options === 'string' ? JSON.parse(ex.options) : ex.options;
            } catch (error) {
                console.error("Failed to parse RAG example options", error.message);
            }
            const passage = (ex.passage_text || '').substring(0, 300);
            return {
                role: 'user', content: `Example ${i + 1}:\n${JSON.stringify({
                    question_type: ex.question_type, passage_text: passage || null,
                    question_text: (ex.question_text || '').substring(0, 300),
                    options: opts, correct_answer: ex.correct_answer,
                    explanation: (ex.explanation || '').substring(0, 200),
                    subject: ex.subject, topic: ex.topic, subtopic: ex.subtopic || ex.skill_description,
                    difficulty: ex.difficulty, difficulty_band: ex.difficulty_band
                }, null, 2)}`
            };
        }), { role: 'user', content: `Generate 1 new SAT question in JSON format.\n\nSubject: ${subject || 'any'}\nTopic: ${topic || 'any'}\nSubtopic/Skill: ${subtopic || 'any'}\nDifficulty: ${difficulty || 'any'}\n\nIMPORTANT:\n- Match the difficulty of the examples shown above.\n- If difficulty is "hard", the question must be genuinely challenging (difficulty_band 6-7).\n- If difficulty is "easy", the question must be straightforward (difficulty_band 1-2).\n- For Reading/Writing blanks, use <u>word</u> format, NOT underscores.\n- NO MARKDOWN. Output ONLY the single JSON object.` }];
        const response = await llm.generateCompletion({ messages, temperature: 0.4, maxTokens: 8000, apiKey: apiKey, embedApiKey: embedApiKey, skipCache: true });
        if (!response.success) throw new Error(response.error)
        const raw = response.content.replace(/```json/g, '').replace(/```/g, "").trim();
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) {
            console.error('LLM raw response:', raw.slice(0, 500))
            throw new Error('No JSON in LLM response');
        }
        const result = JSON.parse(match[0].trim());
        if (result.question_text) {
            result.question_text = result.question_text.replace(/_{2,}\s*(?:blank)?\s*/gi, '<span style="text-decoration: underline;"> </span>');
        }
        let opts = result.options;
        if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
            opts = Object.entries(opts).map(([label, content]) => ({ label, content }));
        }
        return { ...result, options: opts ? JSON.stringify(opts) : null, tags: JSON.stringify([result.skill_code || "", result.subject]), source: "ai_generated", is_active: false };
    }

    async saveGeneratedQuestion(question) {
        const text = question.stem_plain_text || question.question_text || ""
        const embedding = text ? await llm.generateEmbedding(text) : null
        const { data, error } = await supabase.from('sat_questions').insert({ ...question, embedding }).select().single();
        if (error) throw error;
        return data;
    }
}

module.exports = new RAGEngine()