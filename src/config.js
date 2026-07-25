require('dotenv').config();
const { z } = require('zod');

const envSchema = z.object({
    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_KEY: z.string().min(1),
    LLM_API_KEY: z.string().min(1),
    LLM_BASE_URL: z.string().url(),
    LLM_MODEL: z.string().min(1),
    EMBEDDING_BASE_URL: z.string().url(),
    EMBEDDING_MODEL: z.string().min(1),
    EMBEDDING_API_KEY: z.string().min(1),
    APP_DOMAIN: z.string().url(),
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production']).default('development'),
    BURST_WINDOW: z.coerce.number().default(10000),
    BURST_MAX: z.coerce.number().default(20),
    BURST_BLOCK_MS: z.coerce.number().default(900000),
    CLEANUP_INTERVAL: z.coerce.number().default(60000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.format());
    process.exit(1);
}

module.exports = parsed.data;