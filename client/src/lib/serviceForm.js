// Turns the "how to do it" part of a guide into the flat text the admin form edits and back.
//
// The form sends the whole block on every save and the server replaces it. So this must carry
// every field the server has. A form that left out the source link of a document would delete
// that link the next time anyone changed a phone number. Nobody would be told.

export const FEE_COLUMNS = ['item', 'amount_rwf', 'note', 'source_url'];
export const DOCUMENT_COLUMNS = ['name', 'notes', 'where_to_get', 'required_if', 'source_url'];
export const OFFICE_COLUMNS = ['name', 'address', 'district', 'hours', 'phone', 'map_url', 'source_url'];
export const STEP_COLUMNS = ['instruction', 'url_at_step'];

const str = (v) => (v === null || v === undefined ? '' : String(v));

const blankRow = (columns) => Object.fromEntries(columns.map((c) => [c, '']));

export function emptyService() {
  return {
    portal_name: '', portal_url: '', portal_help_url: '',
    who_can_apply: '', processing_text: '', days_min: '', days_max: '', checked_at: '',
    fees: [], documents: [], offices: [], walkthrough: [], unconfirmed: '',
  };
}

export const newRow = {
  fees: () => blankRow(FEE_COLUMNS),
  documents: () => blankRow(DOCUMENT_COLUMNS),
  offices: () => blankRow(OFFICE_COLUMNS),
  walkthrough: () => blankRow(STEP_COLUMNS),
};

const rowsToForm = (rows, columns) =>
  (rows ?? []).map((row) => Object.fromEntries(columns.map((c) => [c, str(row[c])])));

export function toFormService(service) {
  if (!service) return emptyService();
  return {
    portal_name: str(service.portal?.name),
    portal_url: str(service.portal?.url),
    portal_help_url: str(service.portal?.help_url),
    who_can_apply: str(service.who_can_apply),
    processing_text: str(service.processing?.text),
    days_min: str(service.processing?.days_min),
    days_max: str(service.processing?.days_max),
    checked_at: str(service.checked_at),
    fees: rowsToForm(service.fees, FEE_COLUMNS),
    documents: rowsToForm(service.documents, DOCUMENT_COLUMNS),
    offices: rowsToForm(service.offices, OFFICE_COLUMNS),
    walkthrough: rowsToForm(service.walkthrough, STEP_COLUMNS),
    unconfirmed: (service.unconfirmed ?? []).join('\n'),
  };
}

// "20000" becomes 20000. Anything else goes through as it is. So the server names the field.
// Number('20 000') is NaN and NaN becomes null in JSON. That would hide the mistake.
const wholeNumber = (text) => (/^\d+$/.test(text) ? Number(text) : text);

// A row with every box empty is a row the admin added and never filled in. It is dropped.
function rowsToApi(rows, columns, shape) {
  const kept = rows
    .map((row) => Object.fromEntries(columns.map((c) => [c, str(row[c]).trim()])))
    .filter((row) => columns.some((c) => row[c] !== ''));
  if (!kept.length) return undefined;
  return kept.map((row) => shape(row));
}

const present = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined));

export function toApiService(form) {
  const out = {};

  const portal = present({ name: form.portal_name.trim(), url: form.portal_url.trim(), help_url: form.portal_help_url.trim() });
  if (Object.keys(portal).length) out.portal = portal;

  if (form.who_can_apply.trim()) out.who_can_apply = form.who_can_apply.trim();

  const fees = rowsToApi(form.fees, FEE_COLUMNS, ({ amount_rwf, ...rest }) => ({
    ...present(rest),
    // Not published is a real answer. So it is null and never 0.
    amount_rwf: amount_rwf === '' ? null : wholeNumber(amount_rwf),
  }));
  if (fees) out.fees = fees;

  const processing = present({
    text: form.processing_text.trim(),
    days_min: form.days_min.trim() === '' ? '' : wholeNumber(form.days_min.trim()),
    days_max: form.days_max.trim() === '' ? '' : wholeNumber(form.days_max.trim()),
  });
  if (Object.keys(processing).length) out.processing = processing;

  const documents = rowsToApi(form.documents, DOCUMENT_COLUMNS, present);
  if (documents) out.documents = documents;
  const offices = rowsToApi(form.offices, OFFICE_COLUMNS, present);
  if (offices) out.offices = offices;
  const walkthrough = rowsToApi(form.walkthrough, STEP_COLUMNS, present);
  if (walkthrough) out.walkthrough = walkthrough;

  const unconfirmed = form.unconfirmed.split('\n').map((l) => l.trim()).filter(Boolean);
  if (unconfirmed.length) out.unconfirmed = unconfirmed;

  if (form.checked_at.trim()) out.checked_at = form.checked_at.trim();

  return Object.keys(out).length ? out : null;
}
