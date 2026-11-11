// The row of figures at the top of an overview. Each figure is a label, a big number and one line
// of words. A figure still loading says "Loading" and one that failed says "Not available", so an
// empty number is never read as a zero.

// Grid columns on a wide screen. Tailwind builds only the classes written out in full, so each is listed.
const COLUMNS = { 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' };

// One figure. `state` is 'ready', 'loading' or 'error'.
function Figure({ label, value, unit, note, state, spanLast }) {
  const shown = state === 'ready' ? value : state === 'error' ? 'Not available' : 'Loading';
  return (
    // With an odd count the last figure is alone on its row. It spans the row so the grey gap does not
    // show as an empty box. With an even count every row is full and nothing spans.
    <div className={`min-w-0 bg-surface px-[22px] py-4 ${spanLast ? 'last:col-span-2 lg:last:col-span-1' : ''}`}>
      <dt className="text-xs font-medium leading-[19px] text-muted-foreground">{label}</dt>
      <dd className={`mt-1 font-sans font-medium leading-tight tracking-tight ${state === 'ready' ? 'text-[20px] text-ink' : 'text-base text-muted-foreground'}`}>
        {shown}
        {/* A small unit after the number, such as "days late". Only when the figure is ready. */}
        {state === 'ready' && unit && <span className="ml-1.5 text-[13px] font-normal text-muted-foreground">{unit}</span>}
      </dd>
      {state === 'ready' && note && <dd className="mt-1 break-words text-xs leading-[19px] text-muted-foreground">{note}</dd>}
    </div>
  );
}

export default function FigureStrip({ figures }) {
  const cols = COLUMNS[figures.length] ?? COLUMNS[4];
  return (
    <section aria-label="Figures" className="mt-6 overflow-hidden rounded-card border border-border">
      {/* The grey gap between cells is the dividing line. It works the same on every row. */}
      <dl className={`grid grid-cols-2 gap-px bg-border ${cols}`}>
        {figures.map((f) => <Figure key={f.label} {...f} spanLast={figures.length % 2 === 1} />)}
      </dl>
    </section>
  );
}
