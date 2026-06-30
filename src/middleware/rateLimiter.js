const rateLimitState = new Map()

function rateLimiter({ requests = 150, windowSeconds = 1800 } = {}) {
    return (req, res, next) => {
        const limitedPaths = ['/vocab/generate', '/vocab/regenerate']
        const shouldLimit = limitedPaths.some(path => req.path.includes(path))
        if (!shouldLimit) {
            return next()
        }
        const ip = req.ip || req.headers['x-forwarded-for']?.split(",")[0]?.trim() || req.connection.remoteAddress;
        const windowId = Math.floor(Date.now() / 1000 / windowSeconds)
        const key = `${ip}:${windowId}`
        const currentCount = (rateLimitState.get(key) || 0) + 1
        rateLimitState.set(key, currentCount)
        if (rateLimitState.size > 10000) {
            const cutoff = Math.floor(Date.now() / 1000 / windowSeconds) - 2
            for (const [k] of rateLimitState) {
                const kWindow = parseInt(k.split(":")[1])
                if (kWindow < cutoff) rateLimitState.delete(k)
            }
        }
        if (currentCount > requests) {
            const retryAfter = Math.max(1, Math.floor(windowSeconds - (Date.now() / 1000 % windowSeconds)));
            return res.status(429).json({ error: `Rate limit exceeded. Try again in ${retryAfter} seconds.`, retryAfterSeconds: retryAfter });
        }
        next();
    }
}
module.exports = rateLimiter;