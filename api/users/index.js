const { supabase } = require('../../lib/supabase');
const { ok, created, fail, withCors, methodNotAllowed } = require('../../lib/response');

// No authentication in this MVP (all APIs intentionally open per project
// requirements). This endpoint exists purely so a demo client/bot can look
// up or create a userId to use with the booking APIs.
module.exports = async (req, res) => {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, phone, created_at')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return ok(res, data);
    } catch (err) {
      console.error('users/list error:', err.message);
      return fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong while fetching users');
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, email, phone } = req.body || {};
      if (!name || !email) {
        return fail(res, 400, 'MISSING_PARAMETERS', 'name and email are required');
      }
      const { data, error } = await supabase
        .from('users')
        .insert({ name, email, phone: phone || null })
        .select()
        .single();
      if (error) {
        if (error.code === '23505') {
          return fail(res, 409, 'EMAIL_ALREADY_EXISTS', 'A user with this email already exists');
        }
        throw error;
      }
      return created(res, {
        id: data.id, name: data.name, email: data.email, phone: data.phone,
      }, 'User created successfully');
    } catch (err) {
      console.error('users/create error:', err.message);
      return fail(res, 500, 'INTERNAL_ERROR', 'Something went wrong while creating the user');
    }
  }

  return methodNotAllowed(res, ['GET', 'POST']);
};
