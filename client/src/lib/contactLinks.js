// What one line of a contact list can be when it is pressed. The list stores plain text, so the page
// works out the kind from the text itself. Anything it cannot read as a phone, an email or a site
// stays plain words: a link is only made where the text is clearly one of those.

const PHONE = /^\+?[0-9][0-9 ]*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/\S*)?$/i;
const HTTPS = /^https:\/\/\S+$/i;
const DIRECTORY = /^nearest district office$/i;

// Returns { kind, href }. kind is one of: none, directory, tel, mailto, web, text.
// A phone number keeps its plus sign and loses its spaces in the href only. The text shown stays as stored.
export function contactLink(value) {
  const text = String(value ?? '').trim();
  if (!text) return { kind: 'none', href: null };
  if (DIRECTORY.test(text)) return { kind: 'directory', href: '/directory' };
  if (PHONE.test(text)) return { kind: 'tel', href: `tel:${text.replace(/\s+/g, '')}` };
  if (EMAIL.test(text)) return { kind: 'mailto', href: `mailto:${text}` };
  if (HTTPS.test(text)) return { kind: 'web', href: text };
  if (DOMAIN.test(text)) return { kind: 'web', href: `https://${text}` };
  return { kind: 'text', href: null };
}

// A directory entry's contact is one line of free text such as "Phone 0788 123 456 hello@firm.rw".
// This cuts the line into pieces. A piece with an href is a phone number or an email or a full https address.
// The rest is plain words. The pieces joined together are always the original text.
// A phone number needs a clear start and end. No letter or digit or plus or slash may sit beside it.
// An email's first part cannot hold a colon or bracket or slash.
// A web address does not take a closing full stop or comma.
const IN_TEXT = /(https:\/\/[^\s<>]*[^\s<>.,;:!?)]|[^\s@,;:<>()/"'[\]]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}|(?<![\w+/-])(?<!\)\s*)\+?\d(?: ?\d){6,}(?![\w@/-]))/g;

export function contactPieces(text) {
  return String(text ?? '').split(IN_TEXT).filter((part) => part !== '').map((part) => {
    const kind = contactLink(part);
    return kind.href && kind.kind !== 'directory' ? { text: part, kind: kind.kind, href: kind.href } : { text: part };
  });
}
