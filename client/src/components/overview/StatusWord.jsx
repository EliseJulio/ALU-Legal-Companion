import { pillClass } from '@/lib/ui';

// A status as a word in the shared status pill (lib/ui.js). The word carries the meaning so the pill reads in greyscale.
// The tone is one of urgent or progress or checked or waiting.
// pillClass maps each to its tone (urgent or current or neutral) so this file keeps no tone list of its own.
export default function StatusWord({ word, tone = 'progress' }) {
  return <span className={pillClass(tone)}>{word}</span>;
}
