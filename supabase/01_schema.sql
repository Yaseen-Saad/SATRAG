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
    visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')) DEFAULT 'private',
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
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(list_id, shared_with_user_id)
);

-- User Custom Words Lists
CREATE TABLE IF NOT EXISTS user_word_lists (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- User Custom Words List
CREATE TABLE IF NOT EXISTS user_word_list_items (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID REFERENCES user_word_lists NOT NULL,
    word_id UUID REFERENCES vocab_entries NOT NULL,
    sort_order INT DEFAULT 0,
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(list_id, word_id)
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
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    school TEXT NOT NULL,
    avatar_url TEXT NOT NULL,
    email TEXT NOT NULL, 
    birthdate TEXT NOT NULL,
    participate_in_leaderboard BOOLEAN DEFAULT true,
    gender TEXT NOT NULL (CHECK gender IN ('male', 'female')),
    referral TEXT NOT NULL (CHECK referral IN ('friend', 'socialmedia', 'school', 'teacher', 'other')),
    llm_apikey TEXT,
    embedding_apikey TEXT,
    first_login TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP DEFAULT NOW(),
);

-- Avatar Images Bucket
INSERT INTO storage.buckets (id, name, owner, public, file_size_limit, allowed_mime_types, created_at, updated_at) VALUES ('avatars', 'avatars', 'postgres', true, 10485760, '["image/jpeg", "image/png", "image/gif"]', NOW(), NOW()) ON CONFLICT DO NOTHING;
    
-- RLS
ALTER TABLE sat_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Enable all on sat_questions" ON sat_questions
    FOR ALL USING (true) WITH CHECK (true);

-- RLS: user_question_state (users own their rows)
ALTER TABLE user_question_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Enable own user_question_state" ON user_question_state
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS:
ALTER TABLE user_words_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Enable own user_words_lists" ON user_words_lists
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS:
ALTER TABLE user_words_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Enable own user_words_list_items" ON user_words_list_items
    FOR ALL USING (EXISTS (SELECT 1 FROM user_words_lists WHERE id = list_id AND user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM user_words_lists WHERE id = list_id AND user_id = auth.uid()));

-- RLS: public_profiles (view everyone)
ALTER TABLE public_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Public Profiles are viewable by everyone" ON public_profiles
    FOR SELECT USING (true);

-- RLS: public_profiles (edit your own)
CREATE POLICY IF NOT EXISTS "Users can update their own public profile only" ON public_profiles
    FOR UPDATE USING (auth.uid()=id) ;

-- RLS: user_question_attempts (users own their rows)
ALTER TABLE user_question_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Enable own user_question_attempts" ON user_question_attempts
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Avatars Policies
CREATE POLICY IF NOT EXISTS "Public read access to avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars' AND public = true);
CREATE POLICY IF NOT EXISTS "Allow uploads to avatars" ON storage.objects
    FOR INSERT USING (bucket_id = 'avatars' AND auth.role() = 'authenticated' AND storage.foldername(name)[1] = auth.uid()::text);

CREATE INDEX IF NOT EXISTS idx_practice_subject ON sat_questions(subject);
CREATE INDEX IF NOT EXISTS idx_practice_topic ON sat_questions(topic);
CREATE INDEX IF NOT EXISTS idx_practice_subtopic ON sat_questions(subtopic);
CREATE INDEX IF NOT EXISTS idx_practice_difficulty ON sat_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_uqs_user_status ON user_question_state(user_id, status);
CREATE INDEX IF NOT EXISTS idx_uqs_user_question ON user_question_state(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_uqs_question_status ON user_question_state(question_id, status);
CREATE INDEX IF NOT EXISTS idx_uqa_question_time ON user_question_attempts(question_id, attempt_time);
CREATE INDEX IF NOT EXISTS idx_word_lists_share_token ON word_lists(share_token);