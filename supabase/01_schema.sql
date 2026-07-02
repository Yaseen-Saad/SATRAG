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
    embedding vector(1024),
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
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    quiz_type TEXT NOT NULL,
    score INT NOT NULL,
    total_questions INT NOT NULL,
    attempt_time TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP DEFAULT NULL
);

-- Quiz questions
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID REFERENCES quiz_attempts ON DELETE CASCADE,
    word_id UUID REFERENCES vocab_entries NOT NULL,
    question_type TEXT NOT NULL,
    prompt TEXT,
    options JSONB,
    correct_index INT NOT NULL,
    user_answer_index INT,
    is_correct BOOLEAN,
    explanation TEXT,
    question_time TIMESTAMP DEFAULT NOW()
);

-- Feedback events
CREATE TABLE IF NOT EXISTS feedback_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    word_id UUID REFERENCES vocab_entries NOT NULL,
    satisfaction_score INT CHECK (satisfaction_score BETWEEN 0 AND 10),
    helpful_components JSONB,
    problematic_components JSONB,
    comments TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Spaced Repetition queue
CREATE TABLE spaced_repetition (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    word_id UUID REFERENCES vocab_entries NOT NULL,
    ease_factor NUMERIC(3,2) NOT NULL DEFAULT 2.5,
    interval_days INT NOT NULL DEFAULT 0,
    due_date TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, word_id)
)

-- SAT Question Bank
CREATE TABLE IF NOT EXISTS sat_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'fill_in_the_blank')),
    subject TEXT NOT NULL CHECK (subject IN ('math', 'reading')),
    topic TEXT NOT NULL,
    subtopic TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    difficulty_band INT CHECK (difficulty_band BETWEEN 1 AND 8),
    options JSONB,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    source TEXT DEFAULT "collegeboard" CHECK (source IN ('collegeboard', 'ai_generated')),
    tags JSONB DEFAULT '[]',
    is_active BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW(),
);

-- Question state per user
CREATE TABLE user_question_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    question_id UUID REFERENCES sat_questions NOT NULL,
    status TEXT DEFAULT "unsolved" CHECK (status IN ('unsolved', 'solved_correct', 'solved_incorrect')),
    marked_for_review BOOLEAN DEFAULT false,
    last_attempt TIMESTAMP,
    times_attempted INT DEFAULT 0,
    times_correct INT DEFAULT 0,
    first_attempt TIMESTAMP,
    first_solved TIMESTAMP,
    best_time_ms INT,
    UNIQUE(user_id, question_id)
);

-- Attempts History
CREATE TABLE user_question_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    question_id UUID REFERENCES sat_questions NOT NULL,
    selected_answer TEXT,
    is_correct BOOLEAN,
    time_taken_ms INT,
    attempt_number INT DEFAULT 1,
    attempt_time TIMESTAMP DEFAULT NOW(),
);

CREATE INDEX idx_practice_subject ON sat_questions(subject);
CREATE INDEX idx_practice_topic ON sat_questions(topic);
CREATE INDEX idx_practice_subtopic ON sat_questions(subtopic);
CREATE INDEX idx_practice_difficulty ON sat_questions(difficulty);
CREATE INDEX idx_uqs_user_status ON user_question_state(user_id, status);
CREATE INDEX idx_uqs_user_question ON user_question_state(user_id, question_id);
CREATE INDEX idx_uqs_question_status ON user_question_state(question_id, status);
CREATE INDEX idx_uqa_question_time ON user_question_attempts(question_id, attempt_time);
