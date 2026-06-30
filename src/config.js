require('dotenv').config();
const { z } = require('zod');

// Creating the schema for environment variables using zod
const envSchema = z.object({
    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string().min(1),
    LLM_API_KEY: z.string().min(1),
    LLM_BASE_URL: z.string().url().default('https://api.zerolimitai.com/v1'),
    LLM_MODEL: z.string().default('gpt-oss-120b'),
    EMBEDDING_BASE_URL: z.string().url().default('https://opencode.ai/zen/v1'),
    EMBEDDING_MODEL: z.string().default('big-pickle'),
    EMBEDDING_API_KEY: z.string().default(''),
    APP_DOMAIN: z.string().default('http://localhost:3000'),
    PORT: z.coerce.number().default(3000),
    SUPABASE_PASSWORD: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.format());
    process.exit(1);
}

module.exports = parsed.data;