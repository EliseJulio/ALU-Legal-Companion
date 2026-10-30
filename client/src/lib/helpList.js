// "Where to get help" in a guide is stored as one paragraph of "Name — what they do." sentences,
// ending with a line about booking through this platform. Run together it is hard to scan.
// This reads it as a list of bodies. A paragraph that does not look like that stays plain text.
const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-Z])/;
const NAME_LIMIT = 90;

function contactFrom(sentence) {
  const at = sentence.indexOf(' — ');
  if (at < 2 || at > NAME_LIMIT) return null;
  return { name: sentence.slice(0, at).trim(), detail: sentence.slice(at + 3).trim() };
}

function parseParagraph(paragraph) {
  const items = [];
  const lead = [];
  const platform = [];
  for (const sentence of paragraph.split(SENTENCE_BREAK)) {
    if (/through this platform/i.test(sentence)) { platform.push(sentence); continue; }
    const contact = contactFrom(sentence);
    if (contact) items.push(contact);
    else if (items.length) items[items.length - 1].detail += ` ${sentence}`;
    else lead.push(sentence);
  }
  if (items.length < 2) return [{ type: 'text', text: paragraph }];

  const blocks = [];
  if (lead.length) blocks.push({ type: 'text', text: lead.join(' ') });
  blocks.push({ type: 'contacts', items });
  if (platform.length) blocks.push({ type: 'platform', text: platform.join(' ') });
  return blocks;
}

export function parseHelp(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  return value.trim().split(/\n{2,}/).flatMap(parseParagraph);
}
