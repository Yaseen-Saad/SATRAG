function normalizeEmail(email) {
    if (!email || typeof email !== 'string') return '';
    let [local, domain] = email.toLowerCase().trim().split('@');
    if (!domain) return email.toLowerCase().trim();
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
        local = local.replace(/\./g, '').split('+')[0];
        domain = 'gmail.com';
    }
    return `${local}@${domain}`;
}

function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').trim();
}

const interpolate = (tpl, args) => {
    let result = tpl
    for (const [key, value] of Object.entries(args)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value ?? ''));
    }
    return result;
};



function parseGeneratedEntry(text, word) {
    if (typeof text !== 'string') {
        text = String(text || '')
    }

    text = text.replace(/```[\s\S]*?```/g, '')

    const lines = text.split('\n').map(l => l.trim()).filter(l => l)
    const entry = {
        word,
        pronunciation: '',
        part_of_speech: '',
        definition: '',
        mnemonic_type: '',
        mnemonic_phrase: '',
        picture_story: '',
        other_forms: '',
        example_sentence: '',
        source: 'generated',
        validation_passed: true,
        quality_score: 7.0,
    }

    const dashPatterns = [
        /^[\w-]+\s+\(([^)]+)\)\s+([\w.]+)\s*—+\s*(.+)/,
        /^[\w-]+\s+\(([^)]+)\)\s*—+\s*(.+)/,
        /^[\w-]+\s+([\w.]+)\s*—+\s*(.+)/,
        /^[\w-]+\s*—+\s*(.+)/,
    ]

    for (const line of lines) {
        for (const pattern of dashPatterns) {
            const m = line?.match(pattern)
            if (m) {
                if (m[1] && m[2] && m[3]) {
                    entry.pronunciation = m[1]
                    entry.part_of_speech = m[2].replace(/\.$/, '')
                    entry.definition = m[3]
                } else if (m[1] && m[2]) {
                    if (m[1].includes('-')) { entry.pronunciation = m[1]; entry.definition = m[2] }
                    else { entry.part_of_speech = m[1].replace(/\.$/, ''); entry.definition = m[2] }
                }
                break
            }
        }
        if (entry.definition) break
    }

    if (!entry.definition) {
        const wl = word.toLowerCase()
        for (const line of lines) {
            if (line.toLowerCase().includes(wl) && /\s*—+\s*/.test(line)) {
                const parts = line.split(/\s*—+\s*/)
                if (parts.length >= 2) {
                    entry.definition = parts.slice(1).join(' — ').trim()
                    break
                }
            }
        }
    }

    if (!entry.definition) {
        for (const line of lines) {
            const colonIdx = line.indexOf(':')
            if (colonIdx > 0 && !/^(sounds?|picture|other|sentence)/i.test(line)) {
                const after = line.slice(colonIdx + 1).trim()
                if (after && after.split(' ').length <= 20) {
                    entry.definition = after
                    break
                }
            }
        }
    }

    let currentField = null
    for (const line of lines) {
        const fl = line.toLowerCase()
        if (/^sounds?\s+like:/.test(fl)) {
            entry.mnemonic_type = 'sounds-like'
            entry.mnemonic_phrase = line.replace(/^Sounds?\s+like:\s*/i, '').trim()
            currentField = null
        } else if (/^picture:/.test(fl)) {
            entry.picture_story = line.replace(/^Picture:\s*/i, '').trim()
            currentField = 'picture_story'
        } else if (/^other\s+forms:/.test(fl)) {
            entry.other_forms = line.replace(/^Other\s+forms:\s*/i, '').trim()
            currentField = 'other_forms'
        } else if (/^s?sentence:/.test(fl)) {
            entry.example_sentence = line.replace(/^[Ss]centence:\s*/i, '').replace(/^Sentence:\s*/i, '').trim()
            currentField = 'example_sentence'
        } else if (currentField && line && !line.match(/^[A-Z][a-z]/)) {
            entry[currentField] += ' ' + line
        }
    }

    if (entry.example_sentence && !entry.example_sentence.toLowerCase().includes(word.toLowerCase())) {
        entry.validation_passed = false
    }
    return entry
}

module.exports = { normalizeEmail, sanitize, interpolate, parseGeneratedEntry }