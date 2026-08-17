const { createClient } = require('@supabase/supabase-js');

// Server-side client using the SERVICE ROLE key.
// This bypasses Row Level Security, which is fine for this demo
// since every API in this project is intentionally left open
// (no auth layer) per project requirements. Never expose the
// service role key to a browser/frontend - it must only be used
// here, in serverless functions running on the server.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

module.exports = { supabase };
