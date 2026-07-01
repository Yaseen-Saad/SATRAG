CREATE TABLE IF NOT EXISTS rag_feedback_examples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    word TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('positive', 'negative')),
    content TEXT NOT NULL,
    source TEXT DEFAULT 'user_feedback',
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rag_feedback_word ON rag_feedback_examples(word);