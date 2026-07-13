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
module.exports = { normalizeEmail, sanitize }