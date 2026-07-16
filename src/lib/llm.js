const config = require('../config')

class LLMResponse {
    constructor({ content, success, error, model, usage, finishReason }) {
        this.content = content;
        this.success = success;
        this.error = error || null;
        this.model = model || "";
        this.usage = usage || {};
        this.finishReason = finishReason || '';
    }
}

class LLMService {
    constructor() {
        this.chatBaseURL = config.LLM_BASE_URL;
        this.chatModel = config.LLM_MODEL;
        this.embedBaseURL = config.EMBEDDING_BASE_URL;
        this.embedModel = config.EMBEDDING_MODEL;
        this.embedApiKey = config.EMBEDDING_API_KEY;
        this.apiKey = config.LLM_API_KEY;
        this.cache = new Map();
        this.cacheSize = 100;
    }

    async generateCompletion({ messages, system, model, maxTokens = 4096, temperature = 0.7, retries = 2, apiKey, embedApiKey, skipCache = false }) {
        const cacheKey = skipCache ? null : JSON.stringify({ messages, system, model, maxTokens, temperature });
        if (cacheKey && this.cache.has(cacheKey) && !skipCache) {
            return this.cache.get(cacheKey);
        }
        const body = {
            model: model || this.chatModel,
            messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
            max_tokens: maxTokens,
            temperature,
        }
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const res = await fetch(`${this.chatBaseURL}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey || this.apiKey}`
                    },
                    body: JSON.stringify(body)
                });
                if (!res.ok) {
                    const errorText = await res.text();
                    if (attempt < retries && res.status >= 500) {
                        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
                        continue;
                    }
                    throw new Error(`Error generating completion (LLM): ${res.status} - ${errorText}`);
                }

                const data = await res.json();
                if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                    throw new Error('Invalid LLM response structure: no choices returned');
                }
                const result = new LLMResponse({ content: data.choices[0].message.content, success: true, model: data.model, usage: data.usage, finishReason: data.choices[0].finish_reason });
                if (cacheKey) {
                    this.cache.set(cacheKey, result);
                    if (this.cache.size > this.cacheSize) {
                        const firstKey = this.cache.keys().next().value;
                        this.cache.delete(firstKey);
                    }
                }
                return result;
            } catch (error) {
                if (attempt === retries) {
                    throw error;
                }
                await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
            }
        }
    }

    async generateEmbedding(text, { apiKey, embedApiKey } = {}) {
        const embeddings = await this.generateEmbeddings([text], { apiKey, embedApiKey });
        return embeddings[0];
    }

    async generateEmbeddings(texts, { apiKey, embedApiKey } = {}) {
        const headers = { 'Content-Type': 'application/json' }
        const key = embedApiKey || this.embedApiKey;

        if (key) {
            headers['Authorization'] = `Bearer ${key}`
        }
        const res = await fetch(`${this.embedBaseURL}/embeddings`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ model: this.embedModel, input: texts, truncate: true })
        })
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Error generating embeddings (LLM): ${res.status} - ${errorText}`);
        }
        const data = await res.json();
        return data.data.map(d => d.embedding);
    }
}

module.exports = new LLMService();