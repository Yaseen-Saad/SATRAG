function notFoundHandler(req, res, next) {
    res.status(404);
    if (req.path.startsWith('/api/')) {
        return res.json({ error: 'Not found' });
    }
    res.render('error', { error: 'Page not found', statusCode: 404 });
}

function errorHandler(err, req, res, next) {
    console.error('Unhandled error:', err);
    res.status(err.status || 500);
    if (req.path.startsWith('/api/')) {
        return res.json({ error: err.message || 'Internal server error' });
    }
    res.render('error', { error: err.message || 'Internal server error', statusCode: err.status || 500 });
}

module.exports = { notFoundHandler, errorHandler };