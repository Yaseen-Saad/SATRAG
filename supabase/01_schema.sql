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

-- Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section TEXT,
    subject TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
);

-- Ticket Messages
CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users not null,
    message TEXT NOT NULL,
    submitted_at TIMESTAMP DEFAULT NOW(),
);

-- SAT Question Bank
CREATE TABLE IF NOT EXISTS sat_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_text TEXT NOT NULL,
    passage_text TEXT,
    stem_plain_text TEXT,
    skill_code TEXT,
    skill_description TEXT,
    embedding vector(1024),
    created_by UUID REFERENCES auth.users,
    updated_at TIMESTAMP DEFAULT NOW(),
    question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'spr')),
    subject TEXT NOT NULL CHECK (subject IN ('math', 'reading', 'writing')),
    topic TEXT NOT NULL,
    subtopic TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    difficulty_band INT CHECK (difficulty_band BETWEEN 1 AND 7),
    options JSONB,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    source TEXT DEFAULT 'collegeboard' CHECK (source IN ('collegeboard', 'ai_generated')),
    tags JSONB DEFAULT '[]',
    is_active BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Question state per user
CREATE TABLE IF NOT EXISTS user_question_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    question_id UUID REFERENCES sat_questions NOT NULL,
    status TEXT DEFAULT 'unsolved' CHECK (status IN ('unsolved', 'solved_correct', 'solved_incorrect')),
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
CREATE TABLE IF NOT EXISTS user_question_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    question_id UUID REFERENCES sat_questions NOT NULL,
    selected_answer TEXT,
    is_correct BOOLEAN,
    time_taken_ms INT,
    attempt_number INT DEFAULT 1,
    attempt_time TIMESTAMP DEFAULT NOW()
);

-- General Words Lists
CREATE TABLE IF NOT EXISTS word_lists (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private', 'system', 'shared')) DEFAULT 'private',
    created_by UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
    cloned_from UUID REFERENCES word_lists ON DELETE SET NULL,
    source_book TEXT,
    word_count INT NOT NULL DEFAULT 0,
    share_token UUID DEFAULT NULL UNIQUE,
    share_token_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS word_list_entries (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID REFERENCES word_lists ON DELETE CASCADE NOT NULL,
    word_id UUID REFERENCES vocab_entries ON DELETE CASCADE NOT NULL,
    sort_order INT DEFAULT 0,
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(list_id, word_id)
);

-- Shared lists
CREATE TABLE IF NOT EXISTS list_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID REFERENCES word_lists ON DELETE CASCADE NOT NULL,
    shared_with_user_id UUID REFERENCES auth.users NOT NULL,
    shared_by_user_id UUID REFERENCES auth.users NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(list_id, shared_with_user_id)
);

-- Flashcards Progress
CREATE TABLE IF NOT EXISTS user_flashcard_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    word_id UUID REFERENCES vocab_entries NOT NULL,
    stage INT DEFAULT 0,
    ease_factor FLOAT DEFAULT 2.5,
    interval_days INT DEFAULT 0,
    next_review TIMESTAMP,
    last_reviewed TIMESTAMP,
    review_count INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    incorrect_count INT DEFAULT 0,
    UNIQUE(user_id, word_id)
);

-- Public Profiles
CREATE TABLE IF NOT EXISTS public_profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    school TEXT NOT NULL DEFAULT '',
    grade TEXT,
    monthly_gen_count INT DEFAULT 0,
    monthly_gen_month TEXT,
    avatar_url TEXT,
    email TEXT NOT NULL DEFAULT '',
    birthdate TEXT,
    participate_in_leaderboard BOOLEAN DEFAULT true,
    gender TEXT CHECK (gender IN ('male', 'female')),
    referral TEXT CHECK (referral IN ('friend', 'socialmedia', 'school', 'teacher', 'other')),
    llm_apikey TEXT,
    embedding_apikey TEXT,
    first_login TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP DEFAULT NOW()
);

-- Per-Topic Practice
CREATE TABLE IF NOT EXISTS user_topic_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    subject TEXT NOT NULL CHECK (subject IN ('math', 'reading', 'writing')),
    topic TEXT NOT NULL,
    subtopic TEXT NOT NULL,
    total_attempts INT DEFAULT 0,
    total_correct INT DEFAULT 0,
    accuracy_pct NUMERIC(5,2) DEFAULT 0,
    avg_time_ms INT DEFAULT 0,
    last_attempt TIMESTAMP DEFAULT NOW(),
    current_difficulty_band INT DEFAULT 3,
    UNIQUE(user_id, subject, topic, subtopic)
);

-- Avatar Images Bucket
INSERT INTO storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
VALUES
  ('avatars', 'avatars', true, 10485760,
   ARRAY['image/jpeg', 'image/png', 'image/gif'],
   NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
ALTER TABLE sat_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sat_questions select" ON sat_questions;
CREATE POLICY "sat_questions select" ON sat_questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "sat_questions insert" ON sat_questions;
CREATE POLICY "sat_questions insert" ON sat_questions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "sat_questions update" ON sat_questions;
CREATE POLICY "sat_questions update" ON sat_questions FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sat_questions delete" ON sat_questions;
CREATE POLICY "sat_questions delete" ON sat_questions FOR DELETE USING (true);


-- RLS: user_question_state
ALTER TABLE user_question_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_question_state select" ON user_question_state;
CREATE POLICY "user_question_state select" ON user_question_state FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_question_state insert" ON user_question_state;
CREATE POLICY "user_question_state insert" ON user_question_state FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_question_state update" ON user_question_state;
CREATE POLICY "user_question_state update" ON user_question_state FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_question_state delete" ON user_question_state;
CREATE POLICY "user_question_state delete" ON user_question_state FOR DELETE USING (auth.uid() = user_id);


-- RLS: user_question_attempts
ALTER TABLE user_question_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_question_attempts select" ON user_question_attempts;
CREATE POLICY "user_question_attempts select" ON user_question_attempts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_question_attempts insert" ON user_question_attempts;
CREATE POLICY "user_question_attempts insert" ON user_question_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_question_attempts delete" ON user_question_attempts;
CREATE POLICY "user_question_attempts delete" ON user_question_attempts FOR DELETE USING (auth.uid() = user_id);


-- RLS: user_topic_stats
ALTER TABLE user_topic_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own topic stats" ON user_topic_stats;
CREATE POLICY "Users can view own topic stats" ON user_topic_stats
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own topic stats" ON user_topic_stats;
CREATE POLICY "Users can insert own topic stats" ON user_topic_stats
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own topic stats" ON user_topic_stats;
CREATE POLICY "Users can update own topic stats" ON user_topic_stats
    FOR UPDATE USING (auth.uid() = user_id);


-- RLS: word_lists
ALTER TABLE word_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "word_lists owner all" ON word_lists;
CREATE POLICY "word_lists owner all" ON word_lists
    FOR ALL USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);


-- RLS: word_list_entries
ALTER TABLE word_list_entries ENABLE ROW LEVEL SECURITY;


-- RLS: public_profiles
ALTER TABLE public_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Profiles are viewable by everyone" ON public_profiles;
CREATE POLICY "Public Profiles are viewable by everyone" ON public_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own public profile only" ON public_profiles;
CREATE POLICY "Users can update their own public profile only" ON public_profiles FOR UPDATE USING (auth.uid() = id);

CREATE INDEX IF NOT EXISTS idx_practice_subject ON sat_questions(subject);
CREATE INDEX IF NOT EXISTS idx_practice_topic ON sat_questions(topic);
CREATE INDEX IF NOT EXISTS idx_practice_subtopic ON sat_questions(subtopic);
CREATE INDEX IF NOT EXISTS idx_practice_difficulty ON sat_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_uqs_user_status ON user_question_state(user_id, status);
CREATE INDEX IF NOT EXISTS idx_uqs_user_question ON user_question_state(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_uqs_question_status ON user_question_state(question_id, status);
CREATE INDEX IF NOT EXISTS idx_uqa_question_time ON user_question_attempts(question_id, attempt_time);
CREATE INDEX IF NOT EXISTS idx_word_lists_share_token ON word_lists(share_token);
CREATE INDEX IF NOT EXISTS idx_uts_user_accuracy ON user_topic_stats(user_id, accuracy_pct);
CREATE INDEX IF NOT EXISTS idx_uts_user_subject ON user_topic_stats(user_id, subject);