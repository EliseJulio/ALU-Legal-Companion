// Checks for ids in the URL.
// A bad id in the URL gets a 404, the same as a missing item. It does not explain why.
const PG_INTEGER_MAX = 2147483647;

// True for a whole number from 1 up to the biggest number the database allows.
// It takes a number or a string of digits.
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

// requireIntParam('id') checks req.params.id. If it is valid, it is turned into a number.
// If not, the answer is 404.
export function requireIntParam(name) {
  return (req, res, next) => {
    const raw = req.params[name];
    if (!isValidId(raw)) return res.status(404).json({ error: 'Not found' });
    req.params[name] = parseInt(raw, 10);
    next();
  };
}
