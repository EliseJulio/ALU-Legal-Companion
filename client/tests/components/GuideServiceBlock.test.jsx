import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import GuideServiceBlock from '@/components/GuideServiceBlock';

const SERVICE = {
  portal: { name: 'IremboGov', url: 'https://irembo.gov.rw/user/citizen/service/dgie/request_a_permit', help_url: 'https://support.irembo.gov.rw/en/help/1' },
  who_can_apply: 'A foreign student holding a Class U1 permit.',
  fees: [
    { item: 'Student permit (Class U1)', amount_rwf: 20000, note: 'renewal' },
    { item: 'Express handling', amount_rwf: null },
  ],
  processing: { text: '7 days for permit renewals in general' },
  documents: [
    { name: 'Passport biodata page', where_to_get: 'Your home country' },
    { name: 'EBM invoice', required_if: 'the seller is VAT-registered' },
  ],
  offices: [{ name: 'DGIE head office', address: 'KG 7 Ave, Kigali', district: 'Gasabo', hours: 'Mon-Fri 8am-5pm', phone: '+250 788 152 222', map_url: 'https://maps.example/dgie' }],
  walkthrough: [
    { instruction: 'Choose Permits.' },
    { instruction: 'Pay the billing number.', url_at_step: 'https://irembo.gov.rw/pay' },
  ],
  unconfirmed: ['How many days before expiry to apply'],
  checked_at: '2026-10-20',
};

describe('GuideServiceBlock', () => {
  it('shows nothing for a guide with no block', () => {
    const { container } = render(<GuideServiceBlock service={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens the exact service page in a new tab, with the help article beside it', () => {
    render(<GuideServiceBlock service={SERVICE} />);
    const open = screen.getByRole('link', { name: /open the service on iremboGov/i });
    expect(open).toHaveAttribute('href', SERVICE.portal.url);
    expect(open).toHaveAttribute('target', '_blank');
    expect(open).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByRole('link', { name: /official help article/i })).toHaveAttribute('href', SERVICE.portal.help_url);
  });

  it('says a fee is not published and never shows it as zero', () => {
    render(<GuideServiceBlock service={SERVICE} />);
    expect(screen.getByText('FRW 20,000')).toBeInTheDocument();
    expect(screen.getByText(/not published\. Ask the office/)).toBeInTheDocument();
    expect(screen.queryByText(/FRW 0/)).not.toBeInTheDocument();
  });

  it('lists the documents with the condition for the one that is not always needed', () => {
    render(<GuideServiceBlock service={SERVICE} />);
    const needs = within(screen.getByRole('region', { name: /what you need/i }));
    expect(needs.getByText('Passport biodata page')).toBeInTheDocument();
    expect(needs.getByText(/only if the seller is VAT-registered/)).toBeInTheDocument();
  });

  it('gives the office a phone link a phone can dial and a link to a map', () => {
    render(<GuideServiceBlock service={SERVICE} />);
    expect(screen.getByRole('link', { name: '+250 788 152 222' })).toHaveAttribute('href', 'tel:+250788152222');
    expect(screen.getByRole('link', { name: /open in maps/i })).toHaveAttribute('href', 'https://maps.example/dgie');
  });

  it('links a step to the official page it happens on', () => {
    render(<GuideServiceBlock service={SERVICE} />);
    const steps = within(screen.getByRole('region', { name: /do it online, step by step/i }));
    expect(steps.getByText('Pay the billing number.')).toBeInTheDocument();
    expect(steps.getByRole('link', { name: /open this page/i })).toHaveAttribute('href', 'https://irembo.gov.rw/pay');
  });

  it('says what could not be confirmed instead of filling it in', () => {
    render(<GuideServiceBlock service={SERVICE} />);
    const box = within(screen.getByRole('region', { name: /ask the office to confirm/i }));
    expect(box.getByText('How many days before expiry to apply')).toBeInTheDocument();
  });

  it('dates the check in words so a reader can judge how old it is', () => {
    render(<GuideServiceBlock service={SERVICE} />);
    expect(screen.getByText('20 October 2026')).toBeInTheDocument();
  });
});

describe('GuideServiceBlock: links and checks', () => {
  // Nobody checks single lines of a guide any more. Old data that still carries a check is not shown.
  it('never says a lawyer checked a line, even when the data carries an old check', () => {
    const old = { status: 'confirmed', checked_by_name: 'Adv. Amani', checked_at: '2026-10-19T09:30:00Z' };
    render(<GuideServiceBlock service={{
      ...SERVICE,
      fees: [{ item: 'Inspection', amount_rwf: 10000, lawyer_check: old }],
      documents: [{ name: 'Yellow card', lawyer_check: old }],
      offices: [{ ...SERVICE.offices[0], lawyer_check: old }],
    }} />);
    expect(screen.queryByText(/Checked by a lawyer/)).toBeNull();
    expect(screen.queryByText(/Adv. Amani/)).toBeNull();
  });

  it("makes no link from an address that is not https", () => {
    const bad = ["javascript:alert(1)", "data:text/html,hi", "http://example.org/x"];
    for (const url of bad) {
      const { unmount } = render(<GuideServiceBlock service={{ portal: { url }, fees: [{ item: "Permit", amount_rwf: 20000, source_url: url }] }} />);
      expect(document.querySelector("a[href^=\"javascript\"], a[href^=\"data\"], a[href^=\"http:\"]")).toBeNull();
      unmount();
    }
  });
});
