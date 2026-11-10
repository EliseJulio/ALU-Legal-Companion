import Select from '@/components/Select';
import { CARD, RING_ON_CANVAS, BUTTON_PRIMARY, BUTTON_OUTLINE, BUTTON_DANGER_SOLID, SELECT } from '@/lib/ui';

// The pieces the admin pages share: buttons, a select and the record lists. Only the staff
// workspaces use them.

// The buttons and the select come from lib/ui.js and keep these names.
export const ADMIN_BUTTON_PRIMARY = BUTTON_PRIMARY;
export const ADMIN_BUTTON_OUTLINE = BUTTON_OUTLINE;
// The last step of something that switches a person or a contact off. Filled, so it reads as the
// final choice.
export const ADMIN_BUTTON_DANGER = BUTTON_DANGER_SOLID;
// A link that looks like a button, for the "back" links on the editors.
export const ADMIN_BACK_LINK = `inline-flex min-h-touch items-center font-semibold text-primary-text underline ${RING_ON_CANVAS}`;

// The select box is the shared one: the same fill, edge and height as every text box.
export const ADMIN_SELECT = SELECT;

// One labelled select, with its hint tied to it so a screen reader reads both.
export function SelectField({ id, label, hint, className = '', children, ...props }) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
      {hint && <p id={hintId} className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <Select id={id} aria-describedby={hintId} className={SELECT} wrapperClassName="mt-2 flex w-full" {...props}>{children}</Select>
    </div>
  );
}

// A card with a list of records. On a wide screen the column names sit above the rows, as a table
// would. On a phone each row stacks and every cell shows its own name in front of its value. The
// rows keep their own text, so nothing a reader needs is only in the table head.
// `template` is the wide grid, one track per column. It is written out in full in each page so
// the class is found when the site is built. The space above the card is set by the caller.
export function RecordList({ title, columns, template, children, className = '' }) {
  return (
    <section className={`${CARD} ${className}`}>
      {title && <h2 className="font-head text-base leading-[1.3] text-ink">{title}</h2>}
      <div className={title ? 'mt-3.5' : ''}>
        {columns && (
          <div className={`hidden gap-3 border-b border-border-soft pb-2 text-xs font-medium text-muted-foreground md:grid ${template}`}>
            {columns.map((name, i) => <span key={i}>{name}</span>)}
          </div>
        )}
        <ul>{children}</ul>
      </div>
    </section>
  );
}

// One row of a RecordList. It must be an <li>, so each record is one list item.
export function RecordRow({ template, children, className = '' }) {
  return (
    <li className={`grid gap-3 border-t border-border-soft py-4 first:border-t-0 first:pt-2 md:items-center ${template} ${className}`}>
      {children}
    </li>
  );
}

// One cell of a row. On a phone the label stands above the value. On a wide screen the column
// name above the list does that job, so the label is hidden there.
export function Cell({ label, children, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      {label && <p className="mb-1 text-xs text-muted-foreground md:hidden">{label}</p>}
      {children}
    </div>
  );
}
