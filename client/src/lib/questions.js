import { apiPost } from '@/lib/api';

// Reads the answer to an anonymous question from its code. The code is sent in the body only,
// never in the address, and no login is sent.
export function lookUpAnonQuestion(code) {
  return apiPost('/questions/anon/status', { code }, { anonymous: true });
}
