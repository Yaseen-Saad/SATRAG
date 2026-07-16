const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true, persistSession: false
    }, realtime: {
        params: {
            eventPerSecond: 10
        }
    }
});

const supabaseService = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false, persistSession: false
    }, realtime: {
        params: {
            eventPerSecond: 10
        }
    }
})

module.exports = supabase;
module.exports.service = supabaseService;