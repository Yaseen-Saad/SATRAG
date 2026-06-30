const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

// Creating a Supabase client using the configuration from config.js
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true, presistSession: false
    }, realtime: {
        params: {
            eventPerSecond: 10
        }
    }
});

module.exports = supabase;