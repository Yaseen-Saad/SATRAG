-- 0. Make feedback_events.user_id nullable for anonymous feedback
ALTER TABLE feedback_events ALTER COLUMN user_id DROP NOT NULL;

-- 1. Drop old function
DROP FUNCTION IF EXISTS match_vocab_entries;

-- 2. Change vector dimension safely
ALTER TABLE vocab_entries ALTER COLUMN embedding TYPE vector(1024) USING embedding::vector(1024);

-- 3. Create function with SETOF return type (auto-matches table columns)
CREATE FUNCTION match_vocab_entries(
    query_embedding vector(1024),
    match_threshold float,
    match_count int
)
RETURNS SETOF vocab_entries
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM vocab_entries
    WHERE 1 - (embedding <=> query_embedding) > match_threshold
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 4. RLS policies
ALTER TABLE vocab_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read vocab_entries" ON vocab_entries;
CREATE POLICY "Anyone can read vocab_entries" ON vocab_entries FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert vocab_entries" ON vocab_entries;
CREATE POLICY "Anyone can insert vocab_entries" ON vocab_entries FOR INSERT WITH CHECK (true);

ALTER TABLE feedback_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read feedback_events" ON feedback_events;
CREATE POLICY "Anyone can read feedback_events" ON feedback_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert feedback_events" ON feedback_events;
CREATE POLICY "Anyone can insert feedback_events" ON feedback_events FOR INSERT WITH CHECK (true);

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read quiz_attempts" ON quiz_attempts;
CREATE POLICY "Anyone can read quiz_attempts" ON quiz_attempts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert quiz_attempts" ON quiz_attempts;
CREATE POLICY "Anyone can insert quiz_attempts" ON quiz_attempts FOR INSERT WITH CHECK (true);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read quiz_questions" ON quiz_questions;
CREATE POLICY "Anyone can read quiz_questions" ON quiz_questions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert quiz_questions" ON quiz_questions;
CREATE POLICY "Anyone can insert quiz_questions" ON quiz_questions FOR INSERT WITH CHECK (true);

ALTER TABLE rag_feedback_examples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read rag_feedback_examples" ON rag_feedback_examples;
CREATE POLICY "Anyone can read rag_feedback_examples" ON rag_feedback_examples FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert rag_feedback_examples" ON rag_feedback_examples;
CREATE POLICY "Anyone can insert rag_feedback_examples" ON rag_feedback_examples FOR INSERT WITH CHECK (true);
