-- 1. Change vector dimension from 768 to 1024
ALTER TABLE vocab_entries ALTER COLUMN embedding TYPE vector(1024);

-- 2. Create the match function for pgvector similarity search
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

