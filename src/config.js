require('dotenv').config();
const { z } = require('zod');

const envSchema = z.object({
    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string().min(1),
    LLM_API_KEY: z.string().min(1),
    LLM_BASE_URL: z.string().url(),
    LLM_MODEL: z.string(),
    EMBEDDING_BASE_URL: z.string().url(),
    EMBEDDING_MODEL: z.string(),
    EMBEDDING_API_KEY: z.string(),
    APP_DOMAIN: z.string(),
    PORT: z.coerce.number().default(3000),
    SUPABASE_PASSWORD: z.string(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.format());
    process.exit(1);
}

module.exports = parsed.data;