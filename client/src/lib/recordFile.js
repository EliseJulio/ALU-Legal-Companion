// An optional file on one line of the record. PDF or JPG or PNG up to 5 MB.
// The checks here only save a trip. The server reads the type from the bytes and checks the size again.
export const MAX_RECORD_FILE_BYTES = 5 * 1024 * 1024;
const TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const EXTENSIONS = /\.(pdf|png|jpe?g)$/i;

// Gives back the words to show when the file will not do. It gives null when the file is fine.
export function problemWithFile(file) {
  if (!TYPES.includes(file.type) && !EXTENSIONS.test(file.name)) return 'Choose a PDF, JPG or PNG file.';
  if (file.size > MAX_RECORD_FILE_BYTES) return 'That file is over 5 MB. Choose a smaller one.';
  if (file.size === 0) return 'That file is empty. Choose another one.';
  return null;
}
