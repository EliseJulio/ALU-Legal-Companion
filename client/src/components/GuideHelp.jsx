import { Link } from 'react-router-dom';
import { parseHelp } from '@/lib/helpList';
import { BUTTON_OUTLINE, RING_ON_CANVAS } from '@/lib/ui';

// A number at the start of what a body does, such as 112 or 3029, is a phone line. It becomes a
// link a phone can dial. A number anywhere else in the sentence stays as text.
function Detail({ text }) {
  const dial = text.match(/^(\d{3,5})\b([\s\S]*)$/);
  if (!dial) return text;
  return (
    <>
      <a href={`tel:${dial[1]}`} className={`inline-flex min-h-touch min-w-touch items-center justify-center rounded font-mono font-bold text-primary underline ${RING_ON_CANVAS}`}>
        {dial[1]}<span className="sr-only"> (call)</span>
      </a>
      {dial[2]}
    </>
  );
}

// The "Where to get help" part of a guide, as a list of bodies with what each one does. Text that
// is not written that way is shown as plain paragraphs, as before.
export default function GuideHelp({ text }) {
  const blocks = parseHelp(text);
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, i) => {
        if (block.type === 'contacts') {
          return (
            <ul key={i} className="divide-y divide-border rounded-card border border-border bg-surface">
              {block.items.map((item) => (
                <li key={item.name} className="px-5 py-4">
                  <p className="font-semibold text-primary">{item.name}</p>
                  <p className="mt-1 text-sm leading-relaxed"><Detail text={item.detail} /></p>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === 'platform') {
          return (
            <div key={i} className="rounded-card border border-border bg-canvas p-5">
              <p className="text-sm leading-relaxed">{block.text}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link to="/directory" className={BUTTON_OUTLINE}>See the directory</Link>
                <Link to="/ask" className={BUTTON_OUTLINE}>Send a written question</Link>
              </div>
            </div>
          );
        }
        return <p key={i} className="whitespace-pre-line">{block.text}</p>;
      })}
    </div>
  );
}
