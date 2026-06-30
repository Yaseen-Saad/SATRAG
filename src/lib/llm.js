const config = require('../config')

// Create LLMService class to handle LLM API interactions
class LLMService {
    constructor() {
        this.chatBaseURL = config.LLM_BASE_URL;
        this.chatModel = config.LLM_MODEL;
        this.embedBaseURL = "https://ollama.com/v1";
        this.embedModel = 'nomic-embed-text'
        tis.apiKey = config.LLM_API_KEY;
    }

    // Creating a method to generate vocabulary mneomics using the LLM API
    async generateCompletion({ messages, syste, model, maxTokens = 2048, temperature = 0.7 }) {
        const body = {
            model: model || this.chatModel,
            messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
            max_tokens: maxTokens,
            temperature,
        }
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
            throw new Error(`Error generating completion (LLM): ${res.status} - ${errorText}`);
        }
        const data = await res.json();
        return data.choices[0].message.content;
    }
    async generateEmbedding(text) {
        const res = await fetch(`${this.embedBaseURL}/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: this.embedModel, input: text })
        });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Error generating embedding (LLM): ${res.status} - ${errorText}`);
        }
        const data = await res.json();
        return data.data[0].embedding;
    }
}

module.exports = new LLMService();