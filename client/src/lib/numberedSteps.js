// A guide's steps are one block of text with the numbers written in it: "1. Do this. 2. Do that."
// Run together they are hard to read. This finds the numbers so the page can show a real list.
// A number only counts when it is 1, then 2, then 3 and so on, and it follows the end of a
// sentence or a new line. So "Art. 4" or "call 112." inside a step never splits it.
const MARKER = /(?<=^|[.!?:;)"”’]\s+|\n\s*)(\d{1,2})\.\s+/g;

export function numberedSteps(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!/^1\.\s/.test(text)) return null;

  const starts = [];
  let expected = 1;
  for (const m of text.matchAll(MARKER)) {
    if (Number(m[1]) !== expected) continue;
    starts.push({ index: m.index, end: m.index + m[0].length });
    expected += 1;
  }
  if (starts.length < 2) return null;

  const items = starts.map((s, i) => text.slice(s.end, starts[i + 1]?.index ?? text.length).trim());
  return items.every(Boolean) ? items : null;
}
