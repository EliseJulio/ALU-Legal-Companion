import { describe, it, expect } from 'vitest';
import { numberedSteps } from '@/lib/numberedSteps';

// A guide's steps are stored as one block of text. The numbers are written into the text,
// "1. Do this. 2. Do that.", so the page has to find them to show a list.
describe('numberedSteps', () => {
  it('splits numbers written inline into one item each', () => {
    expect(numberedSteps('1. Do not reply. 2. Do NOT delete the messages. 3. Write a note.')).toEqual([
      'Do not reply.', 'Do NOT delete the messages.', 'Write a note.',
    ]);
  });

  it('splits numbers that start a new line', () => {
    expect(numberedSteps('1. First step\n2. Second step\n3. Third step')).toEqual(['First step', 'Second step', 'Third step']);
  });

  it('does not split on a number that is part of a sentence', () => {
    const items = numberedSteps('1. Call the Police on 112. If it involves violence call 3029. 2. Go to the RIB office. 3. Bring Art. 4 of the law.');
    expect(items).toEqual([
      'Call the Police on 112. If it involves violence call 3029.',
      'Go to the RIB office.',
      'Bring Art. 4 of the law.',
    ]);
  });

  it('returns null for text that is not a numbered list', () => {
    expect(numberedSteps('Go to the office and ask for the form.')).toBeNull();
    expect(numberedSteps('1. Only one numbered item.')).toBeNull();
    expect(numberedSteps('See Art. 24 of Law No. 66/2018. It applies to you.')).toBeNull();
    expect(numberedSteps(undefined)).toBeNull();
  });

  it('returns null when the numbers do not run 1, 2, 3 in order', () => {
    expect(numberedSteps('1. First. 3. Third.')).toBeNull();
  });
});
