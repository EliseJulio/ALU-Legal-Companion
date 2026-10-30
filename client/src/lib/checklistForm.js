// Turns a document checklist into what the admin form edits and back.
// The server replaces the checklist on every save. So every field must survive the trip. A source
// link or an "only if" condition dropped here is dropped from the checklist and nobody is told.

export const ITEM_TEXT = ['key', 'name', 'notes', 'where_to_get', 'required_if', 'source_url'];

const str = (v) => (v === null || v === undefined ? '' : String(v));

// A new document starts as required. Most documents on a list are. The exceptions are the ones
// with a condition.
export const blankItem = () => ({ ...Object.fromEntries(ITEM_TEXT.map((c) => [c, ''])), required: true });

// "The seller's taxes are settled!" becomes "the-seller-s-taxes-are-settled". It follows the
// rule of the server. Lower-case letters, digits and single hyphens. It is cut at 60 characters.
export function slugify(text) {
  return String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
}

export function toFormChecklist(c) {
  return {
    slug: str(c?.slug),
    title: str(c?.title),
    description: str(c?.description),
    items: (c?.items ?? []).map((item) => ({
      ...Object.fromEntries(ITEM_TEXT.map((k) => [k, str(item[k])])),
      // false stays false. Only an explicit false makes a document optional.
      required: item.required !== false,
    })),
  };
}

export function toApiChecklist(form) {
  const out = { slug: form.slug.trim(), title: form.title.trim() };
  if (form.description.trim()) out.description = form.description.trim();

  out.items = form.items
    .map((row) => ({ ...Object.fromEntries(ITEM_TEXT.map((k) => [k, str(row[k]).trim()])), required: row.required !== false }))
    // A row with every text box empty is a row the admin added and never filled in.
    .filter((row) => ITEM_TEXT.some((k) => row[k] !== ''))
    .map((row) => {
      // An admin should not have to invent a key for the system. It is made from the name.
      const key = row.key || slugify(row.name);
      return Object.fromEntries(Object.entries({ ...row, key }).filter(([k, v]) => k === 'required' || v !== ''));
    });
  return out;
}
