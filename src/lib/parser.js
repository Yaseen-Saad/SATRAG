const fs = require('fs');

function parseSampleEntries(filePath) {
    const text = fs.readFileSync(filePath, 'utf-8');
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const entries = [];

    const FIELD_NAMES = ['Sounds like:', 'Looks like:', 'First:', 'Picture:', 'Other forms:', 'Sentence:'];
    const MAIN_LINE_RE = /^(\w[\w-]*)\s+\(([^)]+)\)\s+([\w.]+)\s*—+\s*(.+)/; // This Regex is totally AI

    let current = null;
    let currentField = null;
    let currentValue = [];

    function flushField() {
        if (!current || !currentField) return;
        const val = currentValue.join(' ').trim();
        switch (currentField) {
            case 'Sounds like:': current.mnemonic_type = 'sounds-like'; current.mnemonic_phrase = val; break;
            case 'Looks like:': current.mnemonic_type = 'looks-like'; current.mnemonic_phrase = val; break;
            case 'First:': current.mnemonic_type = 'first'; current.mnemonic_phrase = val; break;
            case 'Picture:': current.picture_story = val; break;
            case 'Other forms:': current.other_forms = val; break;
            case 'Sentence:': current.example_sentence = val; break;
        }
        currentField = null;
        currentValue = [];
    }

    function flushEntry() {
        if (current && current.definition && current.example_sentence) {
            entries.push(current);
        }
        current = null;
        currentField = null;
        currentValue = [];
    }

    for (const line of lines) {
        const mainMatch = line.match(MAIN_LINE_RE);
        if (mainMatch) {
            flushField();
            flushEntry();
            current = {
                word: mainMatch[1],
                pronunciation: mainMatch[2],
                part_of_speech: mainMatch[3].replace(/\.$/, ''),
                definition: mainMatch[4],
                mnemonic_type: '',
                mnemonic_phrase: '',
                picture_story: '',
                other_forms: '',
                example_sentence: '',
                source: 'sample',
            };
            continue;
        }

        const field = FIELD_NAMES.find(f => line.startsWith(f));
        if (field) {
            flushField();
            currentField = field;
            currentValue = [line.slice(field.length).trim()];
        } else if (currentField) {
            currentValue.push(line);
        }
    }

    flushField();
    flushEntry();

    return entries;
}
module.exports = { parseSampleEntries };