// Checks for ids in routes and request bodies.
// An id in a route address points at one thing. A badly written id is the same to the user as
// a missing thing, so it gets 404 and no explanation. An id in a request body is not a lookup,
// so a bad one gets a 400 that says what to fix.
const PG_INTEGER_MAX = 2147483647;

// True only for a whole number from 1 to 2147483647, the range of a Postgres INTEGER.
// A bigger number would fail inside the database driver. Accepts a number (a JSON body) or a
// string of digits (a route address or a body field sent as text).
export function isValidId(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 1 && value <= PG_INTEGER_MAX;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value);
    return n >= 1 && n <= PG_INTEGER_MAX;
  }
  return false;
}

// requireIntParam('id') accepts a valid id and puts the number back in req.params, so the
// route can use it directly. Anything else gets 404.
export function requireIntParam(name) {
  return (req, res, next) => {
    const raw = req.params[name];
    if (!isValidId(raw)) return res.status(404).json({ error: 'Not found' });
    req.params[name] = parseInt(raw, 10);
    next();
  };
}
