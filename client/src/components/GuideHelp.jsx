import { Link } from 'react-router-dom';
import { parseHelp } from '@/lib/helpList';
import { BUTTON_OUTLINE, RING_ON_CANVAS, CARD } from '@/lib/ui';

// A phone line at the start of what a body does becomes a link a phone can dial. It is a short code
// (such as 112 or 3029) only when nothing but punctuation follows it, or a full number with a country
// code or at least 9 digits. A number that starts a sentence, such as "2026 reforms" or "1500 FRW fee",
// stays as text.
function phoneAtStart(text) {
  const short = text.match(/^(\d{3,5})(?=\.?$|[,;:])/);
  if (short) return { number: short[1], rest: text.slice(short[1].length) };
  const long = text.match(/^\+?\d[\d\s().-]*\d/);
  if (!long) return null;
  const digits = long[0].replace(/\D/g, '');
  const dialable = long[0].startsWith('+') ? digits.length >= 8 : digits.length >= 9;
  if (!dialable) return null;
  return { number: long[0], rest: text.slice(long[0].length), dial: long[0].replace(/[^\d+]/g, '') };
}

function Detail({ text }) {
  const phone = phoneAtStart(text);
  if (!phone) return text;
  return (
    <>
      <a href={`tel:${phone.dial ?? phone.number}`} className={`inline-flex min-h-touch min-w-touch items-center justify-center rounded-control font-mono font-bold text-primary-text underline ${RING_ON_CANVAS}`}>
        {phone.number}<span className="sr-only"> (call)</span>
      </a>
      {phone.rest}
    </>
  );
}

// The "Where to get help" part of a guide, as a list of bodies with what each one does. Text that
// is not written that way is shown as plain paragraphs.
export default function GuideHelp({ text }) {
  const blocks = parseHelp(text);
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, i) => {
        if (block.type === 'contacts') {
          return (
            <ul key={i} className="divide-y divide-border-soft rounded-card border border-border bg-surface">
              {block.items.map((item, n) => (
                <li key={`${n}-${item.name}`} className="px-5 py-4">
                  <p className="font-semibold text-ink">{item.name}</p>
                  <p className="mt-1 text-sm leading-relaxed"><Detail text={item.detail} /></p>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === 'platform') {
          return (
            <div key={i} className={`${CARD}`}>
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
