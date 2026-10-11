import { Check } from 'lucide-react';
import { readableDate } from '@/lib/dates';

// An icon and text. The stamp is navy and not green. It must still read as verified in a
// greyscale screenshot. Colour alone never carries meaning.
export default function VerifiedStamp({ name, date }) {
  const when = readableDate(date);
  if (!name || !when) return null;
  return (
    <span className="inline-flex items-center gap-1.5 
    rounded border border-primary px-2 py-1 text-primary">
      <Check aria-hidden="true" className="h-3.5 w-3.5" />
      <span className="font-mono text-xs">Verified by {name} on {when}</span>
    </span>
  );
}
