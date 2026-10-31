import { describe, it, expect } from 'vitest';
import { emptyService, toFormService, toApiService, newRow } from '@/lib/serviceForm';

const FULL = {
  portal: { name: 'IremboGov', url: 'https://irembo.gov.rw/x', help_url: 'https://support.irembo.gov.rw/y' },
  who_can_apply: 'A foreign student.',
  fees: [{ item: 'Permit', amount_rwf: 20000, note: 'renewal', source_url: 'https://migration.gov.rw/z' }, { item: 'Express', amount_rwf: null }],
  processing: { text: '7 days', days_min: 7, days_max: 7 },
  documents: [{ name: 'Passport page', notes: 'PDF', where_to_get: 'Passport office', required_if: 'always', source_url: 'https://migration.gov.rw/z' }],
  offices: [{ name: 'DGIE', address: 'KG 7 Ave', district: 'Gasabo', hours: 'Mon-Fri', phone: '+250 788 152 222', map_url: 'https://maps.example/d', source_url: 'https://migration.gov.rw/a' }],
  walkthrough: [{ instruction: 'Choose Permits', url_at_step: 'https://irembo.gov.rw/p' }],
  unconfirmed: ['The exact price', 'The days before expiry'],
  checked_at: '2026-10-20',
};

describe('serviceForm', () => {
  it('turns a saved block into form text and back without losing a field', () => {
    expect(toApiService(toFormService(FULL))).toEqual(FULL);
  });

  it('gives an empty form for a guide with no block and sends null for an empty form', () => {
    expect(toFormService(null)).toEqual(emptyService());
    expect(toApiService(emptyService())).toBeNull();
  });

  it('drops a row the admin added and never filled in', () => {
    const form = { ...emptyService(), fees: [newRow.fees(), { item: 'Permit', amount_rwf: '', note: '', source_url: '' }] };
    expect(toApiService(form)).toEqual({ fees: [{ item: 'Permit', amount_rwf: null }] });
  });

  it('sends digits as a number and an empty amount as null, never as zero', () => {
    const form = { ...emptyService(), fees: [{ item: 'A', amount_rwf: '20000', note: '', source_url: '' }, { item: 'B', amount_rwf: '', note: '', source_url: '' }] };
    expect(toApiService(form).fees.map((f) => f.amount_rwf)).toEqual([20000, null]);
  });

  it('passes a badly typed amount through unchanged so the server names the field', () => {
    const form = { ...emptyService(), fees: [{ item: 'A', amount_rwf: '20 000', note: '', source_url: '' }] };
    expect(toApiService(form).fees[0].amount_rwf).toBe('20 000');
  });

  it('keeps one unconfirmed item for each line and drops blank lines', () => {
    const form = { ...emptyService(), unconfirmed: 'First\n\n  Second  \n' };
    expect(toApiService(form).unconfirmed).toEqual(['First', 'Second']);
  });
});
