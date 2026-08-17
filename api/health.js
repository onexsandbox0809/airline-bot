const { ok, withCors } = require('../lib/response');

module.exports = async (req, res) => {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  return ok(res, null, 'Airline Bot API is running');
};
