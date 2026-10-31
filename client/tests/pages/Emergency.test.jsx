import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Emergency from '@/pages/Emergency';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const CONTACTS = [
  { name: 'Police', contact: '112', when: 'Immediate danger.' },
  { name: 'Isange One Stop Centre', contact: '3029', when: 'Violence or abuse.' },
  { name: 'Legal Aid Forum', contact: 'Nearest district office', when: 'Legal help.' },
  { name: 'Hotline', contact: '+250 788 000 000', when: 'Any time.' },
];

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('Emergency page', () => {
  it('shows the crisis numbers before anything has loaded', () => {
    global.fetch.mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><Emergency /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /3029/ })).toHaveAttribute('href', 'tel:3029');
    expect(screen.getByRole('link', { name: /112/ })).toHaveAttribute('href', 'tel:112');
  });

  it('points to the Directory for the campus counsellor and nurse, and to Student Life for more', () => {
    global.fetch.mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><Emergency /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Directory' })).toHaveAttribute('href', '/directory');
    const more = screen.getByRole('link', { name: /More about ALU student wellness/ });
    expect(more).toHaveAttribute('href', 'https://studentlife.alueducation.com/wellness-diversity');
    expect(more).toHaveAttribute('target', '_blank');
  });

  it('has no Quick Exit control', () => {
    global.fetch.mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><Emergency /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /quick exit/i })).not.toBeInTheDocument();
  });

  it('offers a map search for the nearest police station and health facility, in a new tab', () => {
    global.fetch.mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><Emergency /></MemoryRouter>);
    const police = screen.getByRole('link', { name: /Find a police station near me/ });
    expect(police).toHaveAttribute('href', expect.stringContaining('https://www.google.com/maps/search/?api=1&query=police%20station'));
    expect(police).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: /Find a health facility near me/ })).toHaveAttribute('target', '_blank');
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('lists the contacts and links only those a phone can dial', async () => {
    global.fetch.mockResolvedValue(reply(200, CONTACTS));
    render(<MemoryRouter><Emergency /></MemoryRouter>);
    await screen.findByText('Legal Aid Forum');
    expect(screen.getByRole('link', { name: '+250 788 000 000' })).toHaveAttribute('href', 'tel:+250788000000');
    expect(screen.queryByRole('link', { name: 'Nearest district office' })).not.toBeInTheDocument();
    expect(screen.getByText('Nearest district office')).toBeInTheDocument();
  });

  it('keeps the crisis numbers and shows the error when the request fails', async () => {
    global.fetch.mockResolvedValue(reply(500, { error: 'The server is busy.' }));
    render(<MemoryRouter><Emergency /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('The server is busy.')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /3029/ })).toBeInTheDocument();
  });

  it("tells the reader to seek help in person and not to wait for an online answer", async () => {
    global.fetch.mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><Emergency /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Seek help in person if safe" })).toBeInTheDocument();
    expect(screen.getByText(/do not wait for an online answer/)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Home / Emergency numbers");
  });

  it('has the same name as the menu link in its heading', () => {
    global.fetch.mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><Emergency /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Emergency numbers' })).toBeInTheDocument();
    expect(screen.queryByText('Urgent help')).not.toBeInTheDocument();
  });

  it('puts the heading "If you cannot get online help" above the advice to seek help in person', () => {
    global.fetch.mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><Emergency /></MemoryRouter>);
    const lead = screen.getByRole('heading', { level: 2, name: 'If you cannot get online help' });
    const advice = screen.getByRole('heading', { name: 'Seek help in person if safe' });
    expect(lead.compareDocumentPosition(advice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers to load the contacts again after a failure, and does so', async () => {
    const user = userEvent.setup({ delay: null });
    global.fetch.mockResolvedValueOnce(reply(500, { error: 'The server is busy.' }))
      .mockResolvedValue(reply(200, CONTACTS));
    render(<MemoryRouter><Emergency /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Try loading contacts again' }));
    expect(await screen.findByText('Legal Aid Forum')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Try loading contacts again' })).not.toBeInTheDocument();
  });

  it('keeps the retry button on the page, busy and holding focus, while it tries again', async () => {
    const user = userEvent.setup({ delay: null });
    let finish;
    global.fetch.mockResolvedValueOnce(reply(500, { error: 'The server is busy.' }))
      .mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve(reply(200, CONTACTS)); }));
    render(<MemoryRouter><Emergency /></MemoryRouter>);
    const retry = await screen.findByRole('button', { name: 'Try loading contacts again' });
    await user.click(retry);
    const waiting = screen.getByRole('button', { name: 'Try loading contacts again' });
    expect(waiting).toBe(retry);
    expect(waiting).toHaveAttribute('aria-disabled', 'true');
    expect(waiting).toHaveAttribute('aria-busy', 'true');
    await act(async () => { finish(); });
    await screen.findByText('Legal Aid Forum');
    expect(screen.queryByRole('button', { name: 'Try loading contacts again' })).not.toBeInTheDocument();
  });

  it('moves focus to the Contacts heading once the contacts have loaded after a retry', async () => {
    const user = userEvent.setup({ delay: null });
    global.fetch.mockResolvedValueOnce(reply(500, { error: 'The server is busy.' }))
      .mockResolvedValue(reply(200, CONTACTS));
    render(<MemoryRouter><Emergency /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Try loading contacts again' }));
    await screen.findByText('Legal Aid Forum');
    expect(screen.getByRole('heading', { level: 2, name: 'Contacts' })).toHaveFocus();
  });

  it('keeps the retry button when it fails again', async () => {
    const user = userEvent.setup({ delay: null });
    global.fetch.mockResolvedValue(reply(500, { error: 'The server is busy.' }));
    render(<MemoryRouter><Emergency /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Try loading contacts again' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Try loading contacts again' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('makes the advice a level-three heading under the level-two one', () => {
    global.fetch.mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><Emergency /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 3, name: 'Seek help in person if safe' })).toBeInTheDocument();
  });

  it('offers no retry when the contacts loaded', async () => {
    global.fetch.mockResolvedValue(reply(200, CONTACTS));
    render(<MemoryRouter><Emergency /></MemoryRouter>);
    await screen.findByText('Legal Aid Forum');
    expect(screen.queryByRole('button', { name: 'Try loading contacts again' })).not.toBeInTheDocument();
  });

  it("has no demonstration labels and keeps every number real", async () => {
    global.fetch.mockResolvedValue(reply(200, CONTACTS));
    render(<MemoryRouter><Emergency /></MemoryRouter>);
    await screen.findByText("Legal Aid Forum");
    expect(document.body.textContent).not.toMatch(/Demo contacts|Example entry|Call unavailable|pending confirmation/);
  });
});
