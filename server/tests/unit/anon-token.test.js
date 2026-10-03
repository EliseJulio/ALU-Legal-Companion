// Anonymous tokens must be hard to guess and must carry no identity.
import { makeAnonToken } from '../../src/services/anonToken.js';

describe('makeAnonToken', () => {
  test('has the XXXX-XXXX-XXXX shape that is easy to copy', () => {
    expect(makeAnonToken()).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  test('is unique across many draws', () => {
    const seen = new Set();
    for (let i = 0; i < 5000; i++) seen.add(makeAnonToken());
    expect(seen.size).toBe(5000);
  });

  test('holds no personal data, only hex and dashes', () => {
    for (let i = 0; i < 100; i++) expect(makeAnonToken()).toMatch(/^[0-9A-F-]+$/);
  });

  test('has 48 bits of randomness', () => {
    const hexChars = makeAnonToken().replace(/-/g, '');
    expect(hexChars).toHaveLength(12); // 16^12 is about 2.8e14 tokens
  });

  // A counter would repeat the same first block. 1000 random draws spread over about 992
  // different first blocks so 900 passes every time and still fails a counter.
  test('draws are random, not in order', () => {
    const prefixes = new Set();
    for (let i = 0; i < 1000; i++) prefixes.add(makeAnonToken().slice(0, 4));
    expect(prefixes.size).toBeGreaterThan(900);
  });
});
