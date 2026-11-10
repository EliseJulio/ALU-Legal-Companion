// The editor's words for the fields the server names in its messages. The server keeps its own
// wording. This turns the field keys in it into the labels the person sees on the form.
export const GUIDE_FIELD_LABELS = {
  domain: 'Area of law',
  title: 'Title',
  summary: 'Summary',
  situation: 'Your situation',
  law_says: 'What the law says',
  your_rights: 'Your rights',
  steps: 'Steps to take',
  get_help: 'Where to get help',
  source_law: 'The law it is based on',
  source_url: 'Link to the full text',
};

const label = (key) => GUIDE_FIELD_LABELS[key] ?? key;

// "Missing template fields: title, law_says" becomes "Fill in: Title, What the law says".
// "title must be 200 characters or fewer" becomes "Title must be 200 characters or fewer".
// Any other message is returned as it came.
export function plainGuideMessage(message) {
  const text = String(message ?? '');
  const missing = /^Missing template fields: (.+)$/.exec(text);
  if (missing) {
    return `Fill in: ${missing[1].split(',').map((key) => key.trim()).filter(Boolean).map(label).join(', ')}`;
  }
  const leading = /^([a-z_]+)( must .*)$/.exec(text);
  if (leading && Object.hasOwn(GUIDE_FIELD_LABELS, leading[1])) return `${label(leading[1])}${leading[2]}`;
  return text;
}

// The same for an error object. The status and anything else on it are kept.
export function plainGuideError(error) {
  if (!error || typeof error.message !== 'string') return error;
  const message = plainGuideMessage(error.message);
  return message === error.message ? error : Object.assign(Object.create(Object.getPrototypeOf(error)), error, { message });
}
