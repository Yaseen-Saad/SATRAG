function notFoundHandler(req, res, next) {
    res.status(404);
    if (!req.accepts('html')) {
        return res.json({ error: 'Not found' });
    }
    res.render('error', { error: 'Page not found', statusCode: 404 });
}

function errorHandler(err, req, res, next) {
    console.error('Unhandled error:', err);
    const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : 'Internal server error'
    res.status(err.status || 500);
    if (!req.accepts('html')) {
        return res.json({ error: message });
    }
    res.render('error', { error: message, statusCode: err.status || 500 });
}

module.exports = { notFoundHandler, errorHandler };