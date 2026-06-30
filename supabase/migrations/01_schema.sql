-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;
-- Vocabulary entries (with vector embeddings) table
CREATE TABLE IF NOT EXISTS vocab_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    word TEXT NOT NULL,
    pronunciation TEXT,
    part_of_speech TEXT,
    definition TEXT,
    mnemonic_type TEXT,
    mnemonic_phrase TEXT,
    picture_story TEXT,
    other_forms TEXT,
    example_sentence TEXT,
    quality_score NUMERIC(3,1),
    validation_passed BOOLEAN DEFAULT false,
    source TEXT DEFAULT 'generated',
    embedding vector(768),
    created_by UUID REFERENCES auth.users,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
-- User progress tracking (spaced reptition)
CREATE TABLE IF NOT EXISTS user_vocab_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    word_id UUID REFERENCES vocab_entries NOT NUll,
    familiarity NUMERIC(3,2) Default 0.0,
    times_seen INT DEFAULT 0,
    times_correct INT DEFAULT 0,
    last_reviewed TIMESTAMP,
    next_review TIMESTAMP,
    UNIQUE(user_id, word_id)
);

-- Quiz attempts