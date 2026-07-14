CREATE OR REPLACE FUNCTION match_vocab_entries(
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
    similarity float
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
        1 - (ve.embedding <=> query_embedding) AS similarity
    FROM vocab_entries ve
    WHERE 1 - (ve.embedding <=> query_embedding) > match_threshold
    ORDER BY ve.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;


CREATE OR REPLACE FUNCTION match_sat_questions(
    query_embedding vector(1024),
    match_subject TEXT DEFAULT NULL,
    match_topic TEXT DEFAULT NULL,
    match_difficulty TEXT DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 5
)
RETURNS TABLE(
    id UUID,
    question_text TEXT,
    passage_text TEXT,
    stem_plain_text TEXT,
    skill_code TEXT,
    skill_description TEXT,
    embedding vector(1024),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    question_type TEXT,
    subject TEXT,
    topic TEXT,
    subtopic TEXT,
    difficulty TEXT,
    difficulty_band INT,
    options JSONB,
    correct_answer TEXT,
    explanation TEXT,
    source TEXT,
    tags JSONB,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sq.id,
        sq.question_text,
        sq.passage_text,
        sq.stem_plain_text,
        sq.skill_code,
        sq.skill_description,
        sq.embedding,
        sq.created_by,
        sq.updated_at,
        sq.question_type,
        sq.subject,
        sq.topic,
        sq.subtopic,
        sq.difficulty,
        sq.difficulty_band,
        sq.options,
        sq.correct_answer,
        sq.explanation,
        sq.source,
        sq.tags,
        sq.is_active,
        sq.created_at,
        1 - (sq.embedding <=> query_embedding) AS similarity
    FROM sat_questions sq
    WHERE 1 - (sq.embedding <=> query_embedding) > match_threshold
      AND (match_subject IS NULL OR sq.subject = match_subject)
      AND (match_topic IS NULL OR sq.topic = match_topic)
      AND (match_difficulty IS NULL OR sq.difficulty = match_difficulty)
    ORDER BY sq.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;




CREATE OR REPLACE FUNCTION public_profile_new_users()
RETURNS TRIGGER AS $$
BEGIN 
    INSERT INTO public_profiles(id, first_name, last_name, school, email, referral, participate_in_leaderboard, first_login, last_login)
    VALUES(
        new.id,
        COALESCE(new.raw_user_meta_data->>'first_name', ''),
        COALESCE(new.raw_user_meta_data->>'last_name', ''),
        COALESCE(new.raw_user_meta_data->>'school', ''),
        COALESCE(new.email, ''),
        COALESCE(new.raw_user_meta_data->>'referral', ''),
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        school = EXCLUDED.school,
        email = EXCLUDED.email,
        referral = EXCLUDED.referral;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUITE PROCEDURE public_profile_new_users()