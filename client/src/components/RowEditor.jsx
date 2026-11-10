import { FORM_FIELD, FORM_TEXTAREA, CHECKBOX, RING } from '@/lib/ui';
import { ADMIN_BUTTON_OUTLINE } from '@/components/AdminRecords';
import { FieldError } from '@/components/wizard/WizardField';
import { useWizardErrors } from '@/components/wizard/WizardContext';

// A list of small records the admin can add to and remove from: fees and documents and offices and steps.
//
// One accessible editor for the four lists. Every box has a label that is always shown.
// Every row is a group called "Document 2" so a screen reader says which row it is in. Remove names the row.
// The rows are kept by the page. This keeps none.
// Messages come from the wizard by id. A row box is "idBase-index-key" and the add button is "idBase-add".
export default function RowEditor({ idBase, legend, hint, itemName, rows, columns, blank, onChange, addLabel }) {
  const errors = useWizardErrors();
  const update = (index, key, value) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  const addId = `${idBase}-add`;

  return (
    <fieldset className="mt-6">
      <legend className="text-sm font-semibold">{legend}</legend>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}

      {rows.map((row, i) => (
        <fieldset key={i} className="mt-3 rounded-card border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-primary-text">{itemName} {i + 1}</legend>
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
                      className={`${CHECKBOX} ${RING}`}
                    />
                    {col.label}
                  </label>
                ) : (
                  <label htmlFor={`${idBase}-${i}-${col.key}`} className="block text-sm font-semibold">{col.label}</label>
                )}
                {col.checkbox ? null : col.wide ? (
                  <textarea
                    id={`${idBase}-${i}-${col.key}`}
                    rows={2}
                    value={row[col.key]}
                    onChange={(e) => update(i, col.key, e.target.value)}
                    aria-invalid={errors[`${idBase}-${i}-${col.key}`] ? true : undefined}
                    aria-describedby={errors[`${idBase}-${i}-${col.key}`] ? `${idBase}-${i}-${col.key}-error` : undefined}
                    className={FORM_TEXTAREA}
                  />
                ) : (
                  <input
                    id={`${idBase}-${i}-${col.key}`}
                    type="text"
                    value={row[col.key]}
                    onChange={(e) => update(i, col.key, e.target.value)}
                    aria-invalid={errors[`${idBase}-${i}-${col.key}`] ? true : undefined}
                    aria-describedby={errors[`${idBase}-${i}-${col.key}`] ? `${idBase}-${i}-${col.key}-error` : undefined}
                    className={FORM_FIELD}
                  />
                )}
                {!col.checkbox && (
                  <FieldError id={`${idBase}-${i}-${col.key}-error`} message={errors[`${idBase}-${i}-${col.key}`]} />
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className={`mt-3 ${ADMIN_BUTTON_OUTLINE}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            Remove {itemName.toLowerCase()} {i + 1}
          </button>
        </fieldset>
      ))}

      <button
        id={addId}
        type="button"
        className={`mt-3 ${ADMIN_BUTTON_OUTLINE}`}
        aria-describedby={errors[addId] ? `${addId}-error` : undefined}
        onClick={() => onChange([...rows, blank()])}
      >
        {addLabel}
      </button>
      <FieldError id={`${addId}-error`} message={errors[addId]} />
    </fieldset>
  );
}
