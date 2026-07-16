const BURST_WINDOW = 10 * 1000;
const BURST_MAX = 20;
const BURST_BLOCK_MS = 15 * 60 * 1000;
const CLEANUP_INTERVAL = 60 * 1000;

const ROUTE_LIMITS = [
    { test: p => p === '/auth/login', requests: 5, windowSeconds: 60 },
    { test: p => p === '/auth/signup', requests: 3, windowSeconds: 60 },
    { test: p => p === '/auth/forgot-password', requests: 3, windowSeconds: 300 },
    { test: p => p.startsWith('/auth/'), requests: 10, windowSeconds: 60 },
    { test: p => p.includes('/vocab/generate'), requests: 10, windowSeconds: 60 },
    { test: p => p.includes('/vocab/regenerate'), requests: 10, windowSeconds: 60 },
    { test: p => p.includes('/practice/generate'), requests: 10, windowSeconds: 60 },
    { test: p => true, requests: 150, windowSeconds: 1800 },
];

const store = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (entry.blockUntil && entry.blockUntil < now) entry.blockUntil = null;
        if (entry.expireAt < now) store.delete(key);
    }
}, CLEANUP_INTERVAL);

function rateLimiter() {
    return (req, res, next) => {
        const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.connection?.remoteAddress;
        const now = Date.now();

        // --- Burst detection ---
        const burstKey = `burst:${ip}`;
        let burst = store.get(burstKey);
        if (!burst) {
            burst = { timestamps: [], blockUntil: null, expireAt: now + BURST_BLOCK_MS * 4 };
            store.set(burstKey, burst);
        }
        if (burst.blockUntil && burst.blockUntil > now) {
            const retrySec = Math.ceil((burst.blockUntil - now) / 1000);
            return sendLimit(res, req, retrySec);
        }
        burst.timestamps = burst.timestamps.filter(t => t > now - BURST_WINDOW);
        burst.timestamps.push(now);
        if (burst.timestamps.length > BURST_MAX) {
            burst.blockUntil = now + BURST_BLOCK_MS;
            burst.timestamps = [];
            return sendLimit(res, req, Math.ceil(BURST_BLOCK_MS / 1000));
        }

        // --- Route-specific limits ---
        const def = ROUTE_LIMITS.find(r => r.test(req.path)) || ROUTE_LIMITS[ROUTE_LIMITS.length - 1];
        const windowId = Math.floor(now / 1000 / def.windowSeconds);
        const routeKey = `route:${ip}:${windowId}:${req.method}:${req.path}`;

        let route = store.get(routeKey);
        if (!route) {
            route = { count: 0, expireAt: (windowId + 1) * def.windowSeconds * 1000 + 5000 };
            store.set(routeKey, route);
        }
        route.count += 1;
        if (route.count > def.requests) {
            const retryAfter = Math.max(1, Math.floor(def.windowSeconds - (now / 1000 % def.windowSeconds)));
            return sendLimit(res, req, retryAfter);
        }

        // Periodic prune
        if (store.size > 50000) {
            const cutoff = now - BURST_BLOCK_MS * 4;
            for (const [k, v] of store) {
                if (v.expireAt < cutoff) store.delete(k);
            }
        }

        next();
    };
}

function sendLimit(res, req, retrySeconds) {
    const msg = `Rate limit exceeded. Try again in ${retrySeconds} seconds.`;
    res.set('Retry-After', String(retrySeconds));
    if (!req.accepts('html')) {
        return res.status(429).json({ error: msg, retryAfterSeconds: retrySeconds });
    }
    res.status(429).render('error', { error: msg, statusCode: 429, title: 'Rate Limited' });
}

module.exports = rateLimiter;
