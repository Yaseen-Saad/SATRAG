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
// Create LLMService class to handle LLM API interactions
class LLMService {
    constructor() {
        this.chatBaseURL = config.LLM_BASE_URL;
        this.chatModel = config.LLM_MODEL;
        this.embedBaseURL = config.EMBEDDING_BASE_URL;
        this.embedModel = config.EMBEDDING_MODEL
        this.embedApiKey = config.EMBEDDING_API_KEY;
        this.apiKey = config.LLM_API_KEY;
        this.cache = new Map();
        this.cacheSize = 100;
    }

    async generateCompletion({ messages, system, model, maxTokens = 2048, temperature = 0.7, retries = 2 }) {
        const cacheKey = JSON.stringify({ messages, system, model, maxTokens, temperature });
        if (this.cache.has(cacheKey)) {
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
                        'Authorization': `Bearer ${this.apiKey}`
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
                const result = new LLMResponse({ content: data.choices[0].message.content, success: true, model: data.model, usage: data.usage, finishReason: data.choices[0].finish_reason });
                this.cache.set(cacheKey, result);
                if (this.cache.size > this.cacheSize) {
                    const firstKey = this.cache.keys().next().value;
                    this.cache.delete(firstKey);
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
    async generateEmbedding(text) {
        const embeddings = await this.generateEmbeddings([text]);
        return embeddings[0];
    }

    async generateEmbeddings(texts) {
        const headers = { 'Content-Type': 'application/json' }
        if (this.embedApiKey) {
            headers['Authorization'] = `Bearer ${this.embedApiKey}`
        }
        const res = await fetch(`${this.embedBaseURL}/embeddings`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ model: this.embedModel, input: texts , truncate: true})
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