import { FIELD, BUTTON_OUTLINE } from '@/lib/ui';

// A list of small records the admin can add to and remove from. Fees, documents, offices and steps.
//
// One accessible editor for the four lists. Every box has a label that is always shown. Every row
// is a group called "Document 2" so a screen reader says which row it is in. Remove names the row.
// The rows are kept by the page. This keeps none.
export default function RowEditor({ idBase, legend, hint, itemName, rows, columns, blank, onChange, addLabel }) {
  const update = (index, key, value) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));

  return (
    <fieldset className="mt-6">
      <legend className="text-sm font-medium">{legend}</legend>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}

      {rows.map((row, i) => (
        <fieldset key={i} className="mt-3 rounded border border-border p-3">
          <legend className="px-1 text-sm font-semibold text-primary">{itemName} {i + 1}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {columns.map((col) => (
              <div key={col.key} className={col.wide ? 'sm:col-span-2' : ''}>
                {col.checkbox ? (
                  // A true or false column such as "required". The label wraps the box so the whole
                  // line is the target. The row keeps a real boolean and not the text "true".
                  <label htmlFor={`${idBase}-${i}-${col.key}`} className="flex min-h-touch items-center gap-2 text-sm">
                    <input
                      id={`${idBase}-${i}-${col.key}`}
                      type="checkbox"
                      checked={Boolean(row[col.key])}
                      onChange={(e) => update(i, col.key, e.target.checked)}
                      className="h-5 w-5"
                    />
                    {col.label}
                  </label>
                ) : (
                  <label htmlFor={`${idBase}-${i}-${col.key}`} className="block text-sm">{col.label}</label>
                )}
                {col.checkbox ? null : col.wide ? (
                  <textarea
                    id={`${idBase}-${i}-${col.key}`}
                    rows={2}
                    value={row[col.key]}
                    onChange={(e) => update(i, col.key, e.target.value)}
                    className={FIELD}
                  />
                ) : (
                  <input
                    id={`${idBase}-${i}-${col.key}`}
                    type="text"
                    value={row[col.key]}
                    onChange={(e) => update(i, col.key, e.target.value)}
                    className={FIELD}
                  />
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className={`mt-3 ${BUTTON_OUTLINE}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            Remove {itemName.toLowerCase()} {i + 1}
          </button>
        </fieldset>
      ))}

      <button type="button" className={`mt-3 ${BUTTON_OUTLINE}`} onClick={() => onChange([...rows, blank()])}>
        {addLabel}
      </button>
    </fieldset>
  );
}
