// Could this text be an email address at all? It is loose on purpose. It only rejects what can
// never be an address. Sign in and forgot password both use it. A stricter rule there could
// disagree with the server about which addresses exist. That would let the form tell a reader
// whether an account exists. The server never does.
export function looksLikeEmail(address) {
  return /^[^@\s]+@[^@\s]+$/.test(address);
}

// Sign-up is limited to the ALU community. Sign in has no such rule because legal experts are
// invited from outside the university. The server checks this again.
export const ALLOWED_DOMAINS = ['alustudent.com', 'alueducation.com'];

export function isAluEmail(address) {
  const domain = address.trim().toLowerCase().split('@')[1];
  return ALLOWED_DOMAINS.includes(domain);
}
