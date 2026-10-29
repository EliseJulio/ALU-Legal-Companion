// Document checklists. "Buying a second-hand car needs these documents."
//
// The documents are stored as JSON on the checklist row and checked here. A guide's service part
// is stored the same way and for the same reason. The steps (draft, pending review, published and
// any edit sends it back to draft) are written against the row. So the documents follow them with
// no second set of steps to keep in line.
//
// A checklist is a claim about what an office will ask for. So a person only sees it once an admin
// has checked and published it.

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HTTPS = /^https:\/\/[^\s/$.?#][^\s]*$/i;
const MAX_ITEMS = 40;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ITEM_FIELDS = ['key', 'name', 'notes', 'where_to_get', 'required_if', 'source_url', 'required'];

// Returns { value } or { errors }. `value` has only known fields that are trimmed and not empty.
export function validateChecklist(input) {
  const errors = [];
  const fail = (path, message) => errors.push(`${path}: ${message}`);
  if (!isObject(input)) return { errors: ['checklist: must be an object'] };

  const text = (obj, key, path, { required = false, max = 1000 } = {}) => {
    const raw = obj[key];
    if (raw === undefined || raw === null) { if (required) fail(`${path}.${key}`, 'is required'); return undefined; }
    if (typeof raw !== 'string') { fail(`${path}.${key}`, 'must be text'); return undefined; }
    const t = raw.trim();
    if (!t) { if (required) fail(`${path}.${key}`, 'is required'); return undefined; }
    if (t.length > max) { fail(`${path}.${key}`, `must be at most ${max} characters`); return undefined; }
    return t;
  };

  const slug = text(input, 'slug', 'checklist', { required: true, max: 60 });
  if (slug !== undefined && !SLUG.test(slug)) fail('checklist.slug', 'use lower-case letters, digits and single hyphens');
  const title = text(input, 'title', 'checklist', { required: true, max: 200 });
  const description = text(input, 'description', 'checklist', { max: 1000 });

  let items;
  if (!Array.isArray(input.items) || input.items.length === 0) {
    fail('items', 'add at least one document');
  } else if (input.items.length > MAX_ITEMS) {
    fail('items', `at most ${MAX_ITEMS} documents`);
  } else {
    const seen = new Set();
    items = input.items.map((item, i) => {
      const path = `items[${i}]`;
      if (!isObject(item)) { fail(path, 'must be an object'); return null; }
      for (const k of Object.keys(item)) if (!ITEM_FIELDS.includes(k)) fail(path, `unknown field "${k}"`);
      const key = text(item, 'key', path, { required: true, max: 60 });
      if (key !== undefined) {
        if (!SLUG.test(key)) fail(`${path}.key`, 'use lower-case letters, digits and single hyphens');
        if (seen.has(key)) fail(`${path}.key`, `"${key}" is used twice`);
        seen.add(key);
      }
      let source_url = text(item, 'source_url', path, { max: 2000 });
      if (source_url !== undefined && !HTTPS.test(source_url)) { fail(`${path}.source_url`, 'must be an https:// link'); source_url = undefined; }
      if (item.required !== undefined && typeof item.required !== 'boolean') fail(`${path}.required`, 'must be true or false');
      const out = {
        key,
        name: text(item, 'name', path, { required: true, max: 300 }),
        notes: text(item, 'notes', path, { max: 800 }),
        where_to_get: text(item, 'where_to_get', path, { max: 500 }),
        required_if: text(item, 'required_if', path, { max: 300 }),
        source_url,
        // Required unless the checklist says it is not. A document with a condition such as "only
        // if the seller is VAT-registered" is marked required: false. So it never blocks "ready".
        required: item.required === false ? false : true,
      };
      return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
    });
  }

  if (errors.length) return { errors };
  return { value: Object.fromEntries(Object.entries({ slug, title, description, items }).filter(([, v]) => v !== undefined)) };
}

// What a matter shows of one checklist item. The state follows the file and not the item. A verdict
// only ever exists on a file.
export function itemState(document) {
  if (!document) return 'missing';
  return document.review_status; // pending, complete, needs_fix or out_of_date
}

// "Ready" means every required item has a file that a lawyer marked complete. An optional or
// conditional item left missing does not block it. It is a statement about the files that were
// checked. It is never a promise that an office will accept the application. The page says so.
export function isReady(items) {
  const required = items.filter((i) => i.required);
  return required.length > 0 && required.every((i) => i.state === 'complete');
}
