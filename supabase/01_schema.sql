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

    -- Public Profiles
    CREATE TABLE IF NOT EXISTS public_profiles (
        id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        school TEXT NOT NULL,
        email TEXT NOT NULL, 
        birthdate TEXT NOT NULL,
        participate_in_leaderboard BOOLEAN DEFAULT true,
        gender TEXT NOT NULL (CHECK gender IN ('male', 'female')),
        referal TEXT NOT NULL (CHECK referal IN ('friend', 'socialmedia', 'school', 'teacher', 'other')),
        llm_apikey TEXT,
        embedding_apikey TEXT,
        first_login TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP DEFAULT NOW(),
    );
    
    -- RLS
    ALTER TABLE sat_questions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "Enable all on sat_questions" ON sat_questions
        FOR ALL USING (true) WITH CHECK (true);

    
    -- RLS: user_question_state (users own their rows)
    ALTER TABLE user_question_state ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "Enable own user_question_state" ON user_question_state
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

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

    CREATE INDEX IF NOT EXISTS idx_practice_subject ON sat_questions(subject);
    CREATE INDEX IF NOT EXISTS idx_practice_topic ON sat_questions(topic);
    CREATE INDEX IF NOT EXISTS idx_practice_subtopic ON sat_questions(subtopic);
    CREATE INDEX IF NOT EXISTS idx_practice_difficulty ON sat_questions(difficulty);
    CREATE INDEX IF NOT EXISTS idx_uqs_user_status ON user_question_state(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_uqs_user_question ON user_question_state(user_id, question_id);
    CREATE INDEX IF NOT EXISTS idx_uqs_question_status ON user_question_state(question_id, status);
    CREATE INDEX IF NOT EXISTS idx_uqa_question_time ON user_question_attempts(question_id, attempt_time);