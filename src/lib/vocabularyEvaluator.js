class VocabularyEvaluator {
    evaluateEntry(entry, targetWord) {
        const issues = [];
        const scores = {};
        const allText = `${entry.definition || ''} ${entry.mnemonic_phrase || ''} ${entry.picture_story || ''} ${entry.example_sentence || ''}`;

        if (this.hasThinkingText(allText)) {
            return { isValid: false, overallScore: 0, issues: ["CRITICAL: Contains thinking/planning text"], suggestions: ["Completely regenerate"], componentScores: { all: 0 } };
        }
        const [circScore, circIssues] = this.checkCircularReferences(entry, targetWord);
        scores.circularAvoidance = circScore;
        issues.push(...circIssues)
        const [defScore, defIssues] = this.checkDefinitionQuality(entry);
        scores.definition = defScore; issues.push(...defIssues);

        const [mnemScore, mnemIssues] = this.checkMnemonicQuality(entry);
        scores.mnemonic = mnemScore; issues.push(...mnemIssues);

        const [picScore, picIssues] = this.checkPictureQuality(entry);
        scores.picture = picScore; issues.push(...picIssues);

        const [sentScore, sentIssues] = this.checkSentenceQuality(entry);
        scores.sentence = sentScore; issues.push(...sentIssues);

        const overall = Object.values(scores).reduce((a, b) => a + b, 0) / Math.max(Object.values(scores).length, 1);
        const hasCritical = issues.some(i => /CRITICAL|REJECT/i.test(i));
        const isValid = overall >= 0.8 && !hasCritical && issues.length < 3;

        return { isValid, overallScore: overall, issues, suggestions: isValid ? [] : ["See issues above"], componentScores: scores };
    }
    hasThinkingText(text) {
        const indicators = ['hmm', 'let me', 'maybe', 'not quite', 'alternatively', 'wait', 'i think', 'not helpful', 'close enough', 'not perfect'];
        return indicators.some(i => text.toLowerCase().includes(i));
    }

    checkCircularReferences(entry, targetWord) {
        const issues = []
        let score = 1;
        const wl = targetWord.toLowerCase()
        if (this.containsWordOrSimilar(entry.definition, wl)) {
            issues.push(`CRITICAL: Definition uses '${targetWord}' or similar`); score -= 0.4;
        }
        if (this.containsWordOrSimilar(entry.mnemonic_phrase, wl)) {
            issues.push(`CRITICAL: Mnemonic uses '${targetWord}' or similar`); score -= 0.3;
        }
        if (this.containsWordOrSimilar(entry.picture_story, wl)) {
            issues.push(`CRITICAL: Picture uses '${targetWord}' or similar`); score -= 0.2;
        }
        // Example sentence SHOULD contain the word, so skip circular check here
        return [Math.max(0, score), issues];
    }
    containsWordOrSimilar(text, word) {
        const t = (text || '').toLowerCase()
        if (new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t)) return true;
        const pairs = {
            candid: ['candied', 'candy', 'candies', 'candor'],
            frank: ['frankfurter', 'franklin'],
            serene: ['serenity', 'serenade'],
            revere: ['reverend', 'reverent', 'reverence']
        }
        if (pairs[word] && pairs[word].some(p => t.includes(p))) return true;
        return false
    }

    checkDefinitionQuality(entry) {
        const d = (entry.definition || '').trim()
        const issues = []
        let score = 1
        const wordCount = d.split(" ").length
        if (!d) {
            issues.push("CRITICAL: Empty definition")
            score = 0;
        }
        else {
            if (wordCount < 3) {
                issues.push("Definition too short");
                score -= 0.3;
            }
            if (wordCount > 15) {
                issues.push("Definition too long");
                score -= 0.2;
            }
            if (!/^[A-Z]/.test(d) && !/^to /i.test(d)) {
                issues.push("Definition should start with capital or 'to'");
                score -= 0.1;
            }
        }
        return [Math.max(0, score), issues];
    }
    checkMnemonicQuality(entry) {
        const m = entry.mnemonic_phrase.trim()
        const issues = []
        let score = 1
        if (!m) {
            issues.push("CRITICAL: Empty mnemonic")
            score = 0
        }
        else if (m.split(" ").length > 15) {
            issues.push("Mnemonic too long")
            score -= 0.2;
        }
        const valid = ['sounds-like', 'looks-like', 'think-of', 'connect-with', 'sounds like', 'looks like', 'think of', 'connect with'];
        if (entry.mnemonic_type
            && !valid.includes(entry.mnemonic_type.toLowerCase())) {
            issues.push(`Invalid mnemonic type: ${entry.mnemonic_type}`)
            score -= 0.2
        }
        return [Math.max(0, score), issues];
    }
    checkPictureQuality(entry) {
        const p = entry.picture_story.trim()
        const issues = []
        let score = 1
        if (!p) {
            issues.push("CRITICAL: Empty [picture story")
            score = 0
        } else {
            const wordCount = p.split(" ").length
            if (wordCount < 5) {
                issues.push("Picture too short")
                score -= 0.3
            }
            if (wordCount > 50) {
                issues.push("Picture too long")
                score -= 0.2
            }
        }
        const thinking = ['<thinking>', '<think>', '</think>', '<tool_call>', 'Maybe', 'For example', 'Need to', 'That seems', 'Let me', 'Actually'];
        for (const pattern of thinking) {
            if (p.toLowerCase().includes(pattern.toLowerCase())) {
                issues.push(`CRITICAL: Thinking text: "${pattern}" present`)
                score -= 0.4; break
            }
        }
        return [Math.max(0, score), issues]
    }
    checkSentenceQuality(entry) {
        const s = entry.example_sentence.trim()
        const issues = []
        let score = 1
        if (!s) {
            issues.push("CRITICAL: Empty example sentence")
            score = 0
        }
        else {
            const wordCount = s.split(" ").length;
            if (wordCount < 5) {
                issues.push("Sentence too short")
                score -= 0.3
            }
            if (wordCount > 20) {
                issues.push("Sentence too long")
                score -= 0.2;
            }
            if (!/^[A-Z]/.test(s)) {
                issues.push("Sentence should start with capital");
                score -= 0.1;
            }
            if (!s.endsWith('.')) {
                issues.push("Sentence should end with period");
                score -= 0.1;
            }
        }
        return [Math.max(0, score), issues];
    }
}
module.exports = new VocabularyEvaluator()