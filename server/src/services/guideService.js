// The "how to do it" part of a guide. Links, fees, documents, offices and steps, each step
// pointing at the page it happens on (such as Irembo's own support article for that step).
//
// It lives on the guide row. So an edit sends the guide back to draft like any other edit.
// This is the only check between what an admin types and what a reader clicks. A link becomes
// an href. So it is checked here and never trusted.

const HTTPS = /^https:\/\/[^\s/$.?#][^\s]*$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const LIMITS = { fees: 20, documents: 40, offices: 10, walkthrough: 30, unconfirmed: 30 };

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Returns { value } or { errors }. Nothing is stored that this did not accept.
export function validateService(input) {
  if (input === undefined || input === null) return { value: null };
  if (!isObject(input)) return { errors: ['service: must be an object'] };

  const errors = [];
  const fail = (path, message) => errors.push(`${path}: ${message}`);

  // A field nobody planned for is data nobody reviewed. So unknown keys are refused.
  function onlyKnown(obj, known, path) {
    for (const key of Object.keys(obj)) if (!known.includes(key)) fail(path, `unknown field "${key}"`);
  }

  function text(obj, key, path, { required = false, max = 1000 } = {}) {
    const raw = obj[key];
    if (raw === undefined || raw === null) {
      if (required) fail(`${path}.${key}`, 'is required');
      return undefined;
    }
    if (typeof raw !== 'string') { fail(`${path}.${key}`, 'must be text'); return undefined; }
    const trimmed = raw.trim();
    if (!trimmed) {
      if (required) fail(`${path}.${key}`, 'is required');
      return undefined;
    }
    if (trimmed.length > max) { fail(`${path}.${key}`, `must be at most ${max} characters`); return undefined; }
    return trimmed;
  }

  function link(obj, key, path) {
    const value = text(obj, key, path, { max: 2000 });
    if (value !== undefined && !HTTPS.test(value)) {
      fail(`${path}.${key}`, 'must be an https:// link');
      return undefined;
    }
    return value;
  }

  function integer(obj, key, path, { nullable = false } = {}) {
    const raw = obj[key];
    if (raw === undefined) return undefined;
    if (raw === null) {
      if (!nullable) fail(`${path}.${key}`, 'must be a number');
      return null;
    }
    if (!Number.isInteger(raw) || raw < 0) { fail(`${path}.${key}`, 'must be a whole number, zero or more'); return undefined; }
    return raw;
  }

  function list(key, known, build) {
    const raw = input[key];
    if (raw === undefined) return undefined;
    if (!Array.isArray(raw)) { fail(key, 'must be a list'); return undefined; }
    if (raw.length > LIMITS[key]) { fail(key, `at most ${LIMITS[key]} entries`); return undefined; }
    return raw.map((item, i) => {
      const path = `${key}[${i}]`;
      if (!isObject(item)) { fail(path, 'must be an object'); return null; }
      onlyKnown(item, known, path);
      return build(item, path);
    });
  }

  // An empty optional field is left out. It is never stored as "".
  const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

  onlyKnown(input, ['portal', 'who_can_apply', 'fees', 'processing', 'documents', 'offices',
    'walkthrough', 'unconfirmed', 'checked_at'], 'service');

  const value = {};

  if (input.portal !== undefined) {
    if (!isObject(input.portal)) fail('portal', 'must be an object');
    else {
      onlyKnown(input.portal, ['name', 'url', 'help_url'], 'portal');
      value.portal = clean({
        name: text(input.portal, 'name', 'portal', { max: 120 }),
        url: link(input.portal, 'url', 'portal'),
        help_url: link(input.portal, 'help_url', 'portal'),
      });
    }
  }

  value.who_can_apply = text(input, 'who_can_apply', 'service', { max: 1500 });

  value.fees = list('fees', ['item', 'amount_rwf', 'note', 'source_url'], (f, p) => clean({
    item: text(f, 'item', p, { required: true, max: 300 }),
    amount_rwf: integer(f, 'amount_rwf', p, { nullable: true }),
    note: text(f, 'note', p, { max: 500 }),
    source_url: link(f, 'source_url', p),
  }));

  if (input.processing !== undefined) {
    if (!isObject(input.processing)) fail('processing', 'must be an object');
    else {
      onlyKnown(input.processing, ['text', 'days_min', 'days_max'], 'processing');
      const days_min = integer(input.processing, 'days_min', 'processing');
      const days_max = integer(input.processing, 'days_max', 'processing');
      if (days_min !== undefined && days_max !== undefined && days_min > days_max) {
        fail('processing', 'days_min cannot be more than days_max');
      }
      value.processing = clean({ text: text(input.processing, 'text', 'processing', { max: 500 }), days_min, days_max });
    }
  }

  value.documents = list('documents', ['name', 'notes', 'where_to_get', 'required_if', 'source_url'], (d, p) => clean({
    name: text(d, 'name', p, { required: true, max: 300 }),
    notes: text(d, 'notes', p, { max: 800 }),
    where_to_get: text(d, 'where_to_get', p, { max: 500 }),
    required_if: text(d, 'required_if', p, { max: 300 }),
    source_url: link(d, 'source_url', p),
  }));

  value.offices = list('offices', ['name', 'address', 'district', 'hours', 'phone', 'map_url', 'source_url'], (o, p) => clean({
    name: text(o, 'name', p, { required: true, max: 200 }),
    address: text(o, 'address', p, { required: true, max: 400 }),
    district: text(o, 'district', p, { max: 100 }),
    hours: text(o, 'hours', p, { max: 200 }),
    phone: text(o, 'phone', p, { max: 60 }),
    map_url: link(o, 'map_url', p),
    source_url: link(o, 'source_url', p),
  }));

  value.walkthrough = list('walkthrough', ['instruction', 'url_at_step'], (s, p) => clean({
    instruction: text(s, 'instruction', p, { required: true, max: 800 }),
    url_at_step: link(s, 'url_at_step', p),
  }));

  if (input.unconfirmed !== undefined) {
    if (!Array.isArray(input.unconfirmed) || input.unconfirmed.length > LIMITS.unconfirmed
        || input.unconfirmed.some((u) => typeof u !== 'string')) {
      fail('unconfirmed', `must be a list of at most ${LIMITS.unconfirmed} texts`);
    } else {
      value.unconfirmed = input.unconfirmed.map((u) => u.trim()).filter(Boolean);
    }
  }

  if (input.checked_at !== undefined) {
    const d = typeof input.checked_at === 'string' ? input.checked_at : '';
    const parsed = new Date(`${d}T00:00:00Z`);
    // 2026-02-30 becomes 2 March. So the text must come back the same after a trip through Date.
    if (!DATE.test(d) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== d) {
      fail('checked_at', 'must be a real date, YYYY-MM-DD');
    } else value.checked_at = d;
  }

  if (errors.length) return { errors };
  return { value: clean(value) };
}
