import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminGuides from '@/pages/AdminGuides';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const GUIDES = [
  { id: 1, title: 'Getting your deposit back', domain: 'tenancy', source_law: 'Law No. 00/0000', status: 'published' },
  { id: 2, title: 'Your written contract', domain: 'employment', source_law: 'Order No. 00/00', status: 'draft', review_comment: 'Article 5 is wrong' },
  { id: 3, title: 'Starting a business', domain: 'business', source_law: 'Law No. 11/1111', status: 'pending_review' },
];

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue(reply(200, GUIDES));
});

const show = () => render(<MemoryRouter><AdminGuides /></MemoryRouter>);

describe('Manage guides', () => {
  it('lists every guide with its state in words', async () => {
    show();
    expect(await screen.findByRole('heading', { name: 'Getting your deposit back' })).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Pending review')).toBeInTheDocument();
    expect(screen.queryByText(/Verified by/)).not.toBeInTheDocument();
  });

  it('shows no note about an expert returning a draft', async () => {
    show();
    await screen.findByRole('heading', { name: 'Your written contract' });
    expect(screen.queryByText(/Returned by an expert/)).not.toBeInTheDocument();
  });

  it('links to the editor for each guide and to a new one', async () => {
    show();
    await screen.findByRole('heading', { name: 'Your written contract' });
    expect(screen.getByRole('link', { name: 'Write a new guide' })).toHaveAttribute('href', '/admin/guides/new');
    const edits = screen.getAllByRole('link', { name: 'Edit' });
    expect(edits.map((a) => a.getAttribute('href'))).toEqual(['/admin/guides/1', '/admin/guides/2', '/admin/guides/3']);
  });

  it('has no control that publishes or verifies anything', async () => {
    show();
    await screen.findByRole('heading', { name: 'Your written contract' });
    expect(screen.queryByRole('button', { name: /publish|verify/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /publish|verify/i })).not.toBeInTheDocument();
  });

  it('says so when there are no guides', async () => {
    global.fetch.mockResolvedValue(reply(200, []));
    show();
    expect(await screen.findByText('There are no guides yet.')).toBeInTheDocument();
  });

  it('shows the server message when the list cannot be loaded', async () => {
    global.fetch.mockResolvedValue(reply(500, { error: 'The server is busy.' }));
    show();
    expect(await screen.findByText('The server is busy.')).toBeInTheDocument();
  });
});
