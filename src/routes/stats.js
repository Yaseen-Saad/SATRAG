const { Router } = require('express')
const supabase = require('../lib/supabase.js')
const router = Router();

router.get('/totalWords', async (req, res) => {
    try {
        const { count, error } = await supabase
            .from('vocab_entries')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ total: count });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/totalUsers', async (req, res) => {
    try {
        const { count, error } = await supabase
            .from('public_profiles')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ total: count });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.get('/totalQuestions', async (req, res) => {
    try {
        const { count, error } = await supabase
            .from('sat_questions')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ total: count });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/totalQuestionsAttempts', async (req, res) => {
    try {
        const { count, error } = await supabase
            .from('user_question_attempts')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ total: count });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.get('/totalLists', async (req, res) => {
    try {
        const { count, error } = await supabase
            .from('word_lists')
            .select('*', { count: 'exact', head: true });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ total: count });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router