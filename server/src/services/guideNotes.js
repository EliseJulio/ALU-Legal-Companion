// Notes meant for the editor must not reach the public. A record that still holds one is not ready.
// The check runs when a record is published. It reads the text a reader or a student sees and nothing else.

// A marker an author leaves for the person who checks the text. Also text left by a test edit.
const NOTES = [
  /\[verify\b[^\]]*\]?/i,
  /integrity-rule check/i,
  /\bQA TEST\b/i,
  /lorem ipsum/i,
];

const FIELDS = [
  ['title', 'Title'],
  ['summary', 'Summary'],
  ['situation', 'Your situation'],
  ['law_says', 'What the law says'],
  ['your_rights', 'Your rights'],
  ['steps', 'Steps'],
  ['get_help', 'Where to get help'],
  ['source_law', 'Source'],
];

// Every text a reader sees in the How to do it block of a guide, with the section it sits in.
export function serviceEntries(service) {
  if (!service || typeof service !== 'object') return [];
  const out = [];
  const add = (label, value) => { if (typeof value === 'string') out.push([label, value]); };
  add('How to do it: portal', service.portal?.name);
  add('How to do it: who can apply', service.who_can_apply);
  for (const f of service.fees ?? []) { add('How to do it: fees', f?.item); add('How to do it: fees', f?.note); }
  add('How to do it: processing', service.processing?.text);
  for (const d of service.documents ?? []) {
    add('How to do it: documents', d?.name);
    add('How to do it: documents', d?.notes);
    add('How to do it: documents', d?.where_to_get);
    add('How to do it: documents', d?.required_if);
  }
  for (const o of service.offices ?? []) {
    add('How to do it: offices', o?.name);
    add('How to do it: offices', o?.address);
    add('How to do it: offices', o?.district);
    add('How to do it: offices', o?.hours);
    add('How to do it: offices', o?.phone);
  }
  for (const s of service.walkthrough ?? []) add('How to do it: steps', s?.instruction);
  for (const u of service.unconfirmed ?? []) add('How to do it: items not confirmed', u);
  return out;
}

// Returns a message for the first note found in a list of [section, text] pairs, or null.
// The message names the section and shows the words.
export function noteIn(entries) {
  for (const [label, text] of entries) {
    if (typeof text !== 'string') continue;
    for (const pattern of NOTES) {
      const hit = text.match(pattern);
      if (hit) {
        const words = hit[0].replace(/\s+/g, ' ').trim().slice(0, 60);
        return `The ${label} still holds a note for the editor (“${words}”). Remove it before publishing.`;
      }
    }
  }
  return null;
}

// Returns a message for the first note found in a guide or null.
export function leftoverNote(guide) {
  const entries = FIELDS.map(([key, label]) => [label, guide[key]]);
  return noteIn([...entries, ...serviceEntries(guide.service)]);
}
