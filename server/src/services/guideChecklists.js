// Builds a document checklist from the documents of a seeded guide, so the two never disagree.
// Nothing is invented here. Every item is a document the guide already lists.
import { validateChecklist } from './checklists.js';

// Items that are in a guide's documents but are not something you hand over as a file.
// Keyed by the guide's title. The seed test checks these entries.
export const NOT_A_FILE = {
  'Renewing Your Student Residence Permit (Class U1)': ['A phone number and/or an email address'],
};

export const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

// A document with a condition (required_if) is not needed by everyone, so it is not required.
// The condition goes into the notes so the reader still sees it.
export function itemFromDocument(doc) {
  const conditional = Boolean(doc.required_if);
  const notes = [doc.notes, conditional ? `Only if ${doc.required_if}.` : null].filter(Boolean).join(' ');
  const item = { key: slugify(doc.name), name: doc.name, required: !conditional };
  if (notes) item.notes = notes;
  if (doc.where_to_get) item.where_to_get = doc.where_to_get;
  if (conditional) item.required_if = doc.required_if;
  if (doc.source_url) item.source_url = doc.source_url;
  return item;
}

// `meta` is { slug, title, description }. Returns the checklist or throws.
export function checklistFromGuide(guide, meta) {
  const skip = new Set(NOT_A_FILE[guide.title] ?? []);
  const items = (guide.service?.documents ?? []).filter((d) => !skip.has(d.name)).map(itemFromDocument);
  const checked = validateChecklist({ ...meta, items });
  if (checked.errors) throw new Error(`${meta.slug}: ${checked.errors.join('; ')}`);
  return checked.value;
}

// Adds the checklist as a published row, once. A row with that slug is left as it is.
// The admin who publishes is the one named on the row.
export async function insertPublishedChecklist(q, c, { guideId, adminId }) {
  await q(
    `INSERT INTO document_checklists (slug, title, description, items, guide_id, status, verified_by, verified_at)
     SELECT $1,$2,$3,$4,$5,'published',$6,now()
      WHERE NOT EXISTS (SELECT 1 FROM document_checklists WHERE slug = $1)`,
    [c.slug, c.title, c.description ?? null, JSON.stringify(c.items), guideId ?? null, adminId]);
}
