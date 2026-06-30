-- 1. Drop existing match function (may have wrong signature)
DROP FUNCTION IF EXISTS match_vocab_entries;

-- 2. Change vector dimension
ALTER TABLE vocab_entries ALTER COLUMN embedding TYPE vector(1024);

-- 3. Create correct match function
CREATE FUNCTION match_vocab_entries(
    query_embedding vector(1024),
    match_threshold float,
    match_count int
)
RETURNS TABLE(
    id uuid,
    word text,
    pronunciation text,
    part_of_speech text,
    definition text,
    mnemonic_type text,
    mnemonic_phrase text,
    picture_story text,
    other_forms text,
    example_sentence text,
    quality_score numeric,
    validation_passed boolean,
    source text,
    created_by uuid,
    created_at timestamptz,
    similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ve.id,
        ve.word,
        ve.pronunciation,
        ve.part_of_speech,
        ve.definition,
        ve.mnemonic_type,
        ve.mnemonic_phrase,
        ve.picture_story,
        ve.other_forms,
        ve.example_sentence,
        ve.quality_score,
        ve.validation_passed,
        ve.source,
        ve.created_by,
        ve.created_at,
        1::double precision - (ve.embedding <=> query_embedding) AS similarity
    FROM vocab_entries ve
    WHERE 1::double precision - (ve.embedding <=> query_embedding) > match_threshold
    ORDER BY ve.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 4. RLS policies for vocab_entries
ALTER TABLE vocab_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read vocab_entries" ON vocab_entries;
CREATE POLICY "Anyone can read vocab_entries"
    ON vocab_entries FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert vocab_entries" ON vocab_entries;
CREATE POLICY "Authenticated users can insert vocab_entries"
    ON vocab_entries FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can insert vocab_entries" ON vocab_entries;
CREATE POLICY "Anyone can insert vocab_entries"
    ON vocab_entries FOR INSERT
    WITH CHECK (true);

-- 5. RLS policies for feedback_events
ALTER TABLE feedback_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read feedback_events" ON feedback_events;
CREATE POLICY "Anyone can read feedback_events"
    ON feedback_events FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert feedback_events" ON feedback_events;
CREATE POLICY "Authenticated users can insert feedback_events"
    ON feedback_events FOR INSERT
    WITH CHECK (true);

-- 6. RLS policies for quiz_attempts
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own quiz_attempts" ON quiz_attempts;
CREATE POLICY "Users can read own quiz_attempts"
    ON quiz_attempts FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own quiz_attempts" ON quiz_attempts;
CREATE POLICY "Users can insert own quiz_attempts"
    ON quiz_attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 7. RLS policies for quiz_questions
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read quiz_questions" ON quiz_questions;
CREATE POLICY "Anyone can read quiz_questions"
    ON quiz_questions FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Anyone can insert quiz_questions" ON quiz_questions;
CREATE POLICY "Anyone can insert quiz_questions"
    ON quiz_questions FOR INSERT
    WITH CHECK (true);

-- 8. RLS policies for rag_feedback_examples
ALTER TABLE rag_feedback_examples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read rag_feedback_examples" ON rag_feedback_examples;
CREATE POLICY "Anyone can read rag_feedback_examples"
    ON rag_feedback_examples FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Anyone can insert rag_feedback_examples" ON rag_feedback_examples;
CREATE POLICY "Anyone can insert rag_feedback_examples"
    ON rag_feedback_examples FOR INSERT
    WITH CHECK (true);
