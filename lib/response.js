function ok(res, data, message = 'Request completed successfully', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function created(res, data, message = 'Created successfully') {
  return ok(res, data, message, 201);
}

function fail(res, status, code, details, message = 'Unable to complete request') {
  return res.status(status).json({
    success: false,
    message,
    error: { code, details },
  });
}

function methodNotAllowed(res, allowed = []) {
  res.setHeader('Allow', allowed.join(', '));
  return fail(res, 405, 'METHOD_NOT_ALLOWED', `Allowed methods: ${allowed.join(', ')}`);
}

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res;
}

module.exports = { ok, created, fail, methodNotAllowed, withCors };
