// Notes meant for the editor must not reach the public. A guide that still holds one is not ready.
// The check runs when a guide is published. It reads the text a reader sees and nothing else.

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

// A marker an author leaves for the person who checks the text. Also text left by a test edit.
const NOTES = [
  /\[verify\b[^\]]*\]?/i,
  /integrity-rule check/i,
  /\bQA TEST\b/i,
  /lorem ipsum/i,
];

// Returns a message for the first note found or null. The message names the section and shows the words.
export function leftoverNote(guide) {
  for (const [key, label] of FIELDS) {
    const text = typeof guide[key] === 'string' ? guide[key] : '';
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
