class QualityChecker {
    constructor() {
        this.weights = {
            authenticity: 0.35,
            creativity: 0.20,
            accuracy: 0.15,
            completeness: 0.20,
            formatcompliance: 0.10
        };
    };
    assessQuality(entry) {
        const scores = {
            authenticity: this.assessAuthenticity(entry),
            creativity: this.assessCreativity(entry),
            accuracy: this.assessAccuracy(entry),
            completeness: this.assessCompleteness(entry),
            formatcompliance: this.assessFormatCompliance(entry)
        };
        const overall = Object.entries(scores).reduce((acc, [key, value]) => acc + value * this.weights[key], 0);
        return { overall, scores, issues: this.identifyIssues(entry, scores), strength: this.identifyStrengths(entry, scores) };
    }
    assessAuthenticity(entry) {
        let score = 10;
        if (!entry.mnemonic_phrase) score -= 3
        else if (['sounds-like', 'looks-like'].includes(entry.mnemonic_type)) score += 0.5;
        if (entry.picture_story) {
            const wordCount = entry.picture_story.split(" ").length;
            if (wordCount < 15) score -= 1.5; else if (wordCount > 60) score -= 1;
            if (/imagine|picture|story|character|scene|visual/i.test(entry.picture_story)) score += 0.5;
        } else score -= 2;
        if (entry.pronunciation && entry.pronunciation.includes('-')) score += 0.5;
        return Math.max(0, Math.min(10, score));
    }
    assessCreativity(entry) {
        let score = 10;
        if (entry.mnemonic_phrase) {
            if (/like|imagine|think|picture|connect/i.test(entry.mnemonic_phrase)) score += 0.5;
        } else score -= 5;
        return Math.max(0, Math.min(10, score));
    }
    assessAccuracy(entry) {
        let score = 10;
        if (entry.example_sentence) {
            if (!entry.example_sentence.toLowerCase().includes(entry.word.toLowerCase())) score -= 2;
        } else score -= 1.5;
        if (entry.pronunciation) { if (!/[(-]/.test(entry.pronunciation)) score -= 1; } else score -= 1;
        if (entry.part_of_speech) {
            if (!/^(noun|verb|adj|adjective|adverb|adv)$/i.test(entry.part_of_speech)) score -= 0.5;
        } else score -= 1;
        return Math.max(0, Math.min(10, score));
    }

    assessCompleteness(entry) {
        let score = 10;
        const required = { word: 2, pronunciation: 1.5, part_of_speech: 1, definition: 2, mnemonic_phrase: 1.5, picture_story: 1.5, example_sentence: 0.5 };
        for (const [field, penalty] of Object.entries(required)) {
            if (!entry[field] || !entry[field].toString().trim()) score -= penalty;
        }
        return Math.max(0, Math.min(10, score));
    }
    assessFormatCompliance(entry) {
        let score = 10;
        if (entry.word && entry.word !== entry.word.toUpperCase()) score -= 1;
        if (entry.part_of_speech && !/^(noun|verb|adj|adjective|adverb|adv)$/i.test(entry.part_of_speech)) score -= 1;
        if (entry.pronunciation && !/^[a-zA-Z0-9\s\(\)\-]+$/.test(entry.pronunciation)) score -= 1;
        if (entry.mnemonic_type && !['sounds-like', 'looks-like'].includes(entry.mnemonic_type)) score -= 1;
        return Math.max(0, Math.min(10, score));
    }
    identifyIssues(entry, scores) {
        const issues = [];
        if (scores.authenticity < 6) issues.push("Doesn't match authentic Gulotta style");
        if (scores.creativity < 6) issues.push("Mnemonic or picture story lacks creativity");
        if (scores.memorability < 6) issues.push("Entry may not be memorable enough");
        if (scores.accuracy < 7) issues.push("Potential accuracy issues");
        if (scores.completeness < 7) issues.push("Missing required components");
        if (!entry.mnemonic_phrase) issues.push("Missing mnemonic device");
        if (!entry.picture_story || entry.picture_story.split(" ").length < 10) issues.push("Missing picture story");
        if (entry.example_sentence && entry.word && !entry.example_sentence.toLowerCase().includes(entry.word.toLowerCase())) issues.push("Example sentence doesn't include the word");
        return issues;
    }

    identifyStrengths(entry, scores) {
        const strengths = []
        if (scores.authenticity >= 8) strengths.push("Matches authentic Gulotta style");
        if (scores.creativity >= 8) strengths.push("Mnemonic or picture story is creative");
        if (scores.memorability >= 8) strengths.push("Entry is memorable");
        if (scores.accuracy >= 8) strengths.push("Entry is accurate");
        if (scores.completeness >= 8) strengths.push("Entry has all required components");
        if (entry.mnemonic_phrase) strengths.push("Entry has a mnemonic device");
        if (entry.picture_story && entry.picture_story.split(" ").length > 20) strengths.push("Entry has long enough story");
        return strengths;
    }

}
model.exports = new QualityChecker()