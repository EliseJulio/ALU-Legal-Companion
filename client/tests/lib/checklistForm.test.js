import { describe, it, expect } from 'vitest';
import { blankItem, slugify, toApiChecklist, toFormChecklist } from '@/lib/checklistForm';

const FULL = {
  slug: 'buying-a-car',
  title: 'Buying a car',
  description: 'What RRA asks for.',
  items: [
    { key: 'sale-agreement', name: 'Notarized sale agreement', notes: 'Signed by both.', where_to_get: 'A notary', required_if: 'always', source_url: 'https://www.rra.gov.rw/a', required: true },
    { key: 'ebm', name: 'EBM invoice', required: false },
  ],
};

describe('checklistForm', () => {
  it('turns a saved checklist into form text and back without losing a field', () => {
    expect(toApiChecklist(toFormChecklist(FULL))).toEqual(FULL);
  });

  it('keeps an optional document optional. Only an explicit false does that', () => {
    const form = toFormChecklist({ slug: 'a', title: 'A', items: [{ key: 'x', name: 'X', required: false }, { key: 'y', name: 'Y' }] });
    expect(form.items.map((i) => i.required)).toEqual([false, true]);
  });

  it('starts a new document as required', () => {
    expect(blankItem().required).toBe(true);
  });

  it('makes the key from the name when the admin left it empty', () => {
    const form = { slug: 'a', title: 'A', description: '', items: [{ ...blankItem(), name: "The seller's taxes are settled!" }] };
    expect(toApiChecklist(form).items[0].key).toBe('the-seller-s-taxes-are-settled');
  });

  it('drops a row the admin added and never filled in', () => {
    const form = { slug: 'a', title: 'A', description: '', items: [blankItem(), { ...blankItem(), name: 'Passport' }] };
    expect(toApiChecklist(form).items).toEqual([{ key: 'passport', name: 'Passport', required: true }]);
  });

  it('leaves an empty description out', () => {
    const form = { slug: 'a', title: 'A', description: '   ', items: [{ ...blankItem(), name: 'X' }] };
    expect(toApiChecklist(form)).not.toHaveProperty('description');
  });

  it.each([
    ['Buying a Second-Hand Car!', 'buying-a-second-hand-car'],
    ['  --Hello   world--  ', 'hello-world'],
    ['', ''],
  ])('makes a short name from "%s"', (text, slug) => {
    expect(slugify(text)).toBe(slug);
  });

  it('cuts a short name at 60 characters without ending on a hyphen', () => {
    const slug = slugify(`${'a'.repeat(59)} b`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });
});
