import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyActivity from '@/pages/MyActivity';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession, clearSession } from '@/lib/auth';

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: async () => body,
});

const QUESTIONS = [
  { id: 1, text: 'Can my landlord keep my deposit?', answer: 'Write to the landlord first.', status: 'answered', created_at: '2026-09-02T09:00:00Z' },
  { id: 2, text: 'What is the notice period?', answer: null, status: 'open', created_at: '2026-09-03T09:00:00Z' },
];

const BOOKINGS = [
  { id: 4, slot: '2099-01-01T08:00:00.000Z', topic: 'My deposit', status: 'accepted', provider_name: 'Example Pro Bono Lawyer', meet_link: 'https://meet.example.org/abc' },
  { id: 5, slot: '2099-02-01T08:00:00.000Z', topic: null, status: 'requested', provider_name: 'Example Legal Aid Office', meet_link: null },
  { id: 6, slot: '2099-03-01T08:00:00.000Z', topic: null, status: 'declined', provider_name: 'Example Pro Bono Lawyer', meet_link: null },
];

let questionsReply;
let bookingsReply;

function show(role = 'student') {
  clearSession();
  if (role) saveSession({ token: 'tok-1', user: { id: 1, name: 'Test User', email: 'a@example.org', role } });
  global.fetch = vi.fn().mockImplementation(async (url) => {
    const path = String(url).replace(/^https?:\/\/[^/]+\/api/, '');
    if (path === '/questions/mine') return questionsReply();
    if (path === '/bookings/mine') return bookingsReply();
    return reply(404, { error: 'unexpected' });
  });
  return render(<MemoryRouter><AuthProvider><MyActivity /></AuthProvider></MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  questionsReply = async () => reply(200, QUESTIONS);
  bookingsReply = async () => reply(200, BOOKINGS);
});

describe('My activity as a student', () => {
  it('lists the questions with the answer or a plain "no answer yet"', async () => {
    show();
    const list = await screen.findByRole('region', { name: 'Questions' });
    const view = within(list);
    expect(await view.findByText('Can my landlord keep my deposit?')).toBeInTheDocument();
    expect(view.getByText('Write to the landlord first.')).toBeInTheDocument();
    expect(view.getByText('What is the notice period?')).toBeInTheDocument();
    expect(view.getByText('No answer yet.')).toBeInTheDocument();
  });

  it('explains each appointment in words and shows how to join only an accepted one', async () => {
    show();
    const section = within(await screen.findByRole('region', { name: 'Consultation requests' }));
    expect(await section.findByText('The lawyer agreed to this time')).toBeInTheDocument();
    expect(section.getByText('Waiting for the lawyer to reply')).toBeInTheDocument();
    expect(section.getByText('This time was not taken')).toBeInTheDocument();
    const joins = section.getAllByRole('link', { name: /Join the video call/ });
    expect(joins).toHaveLength(1);
    expect(joins[0]).toHaveAttribute('href', 'https://meet.example.org/abc');
  });

  it('offers another lawyer after a declined appointment', async () => {
    show();
    expect(await screen.findByRole('link', { name: 'Ask another lawyer in the directory' })).toHaveAttribute('href', '/directory');
  });

  it('says that an anonymous question or booking will never be listed and links to the checks', async () => {
    show();
    await screen.findByRole('region', { name: 'Questions' });
    expect(screen.getByText(/never listed here/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Check an anonymous question →' })).toHaveAttribute('href', '/ask/check');
    expect(screen.getByRole('link', { name: 'Check an anonymous booking →' })).toHaveAttribute('href', '/directory/booking-check');
  });

  it('keeps the anonymous sentence when both lists are empty', async () => {
    questionsReply = async () => reply(200, []);
    bookingsReply = async () => reply(200, []);
    show();
    expect(await screen.findByText('You have not asked a legal expert anything yet.')).toBeInTheDocument();
    expect(screen.getByText('You have not requested an appointment yet.')).toBeInTheDocument();
    expect(screen.getByText(/never listed here/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ask a lawyer' })).toHaveAttribute('href', '/ask');
    expect(screen.getByRole('link', { name: 'Find a lawyer' })).toHaveAttribute('href', '/directory');
  });

  it('shows one error beside the list that failed and still shows the other', async () => {
    questionsReply = async () => reply(500, { error: 'The questions are unavailable.' });
    show();
    const questions = within(await screen.findByRole('region', { name: 'Questions' }));
    expect(await questions.findByText('The questions are unavailable.')).toBeInTheDocument();
    const bookings = within(screen.getByRole('region', { name: 'Consultation requests' }));
    expect(await bookings.findByText('The lawyer agreed to this time')).toBeInTheDocument();
    expect(bookings.queryByText('The questions are unavailable.')).not.toBeInTheDocument();
  });
});

describe('My activity without a student or staff account', () => {
  it('asks a visitor to sign in without asking the server', () => {
    show(null);
    expect(screen.getByText('Sign in to see what you have asked for.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('tells an expert or admin that nothing is wrong and does not ask the server', () => {
    for (const role of ['legal_expert', 'admin']) {
      const { unmount } = show(role);
      expect(screen.getByText('This page tracks student and staff accounts.')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalled();
      unmount();
    }
  });
});

describe("My activity: what the page promises", () => {
  it("says this is private account activity", async () => {
    show("student");
    expect(await screen.findByText("This is your private account activity")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Home / My Activity");
  });
});

describe('My activity: the page as designed', () => {
  it('is called My Activity and says anonymous submissions are not listed', async () => {
    show();
    expect(await screen.findByRole('heading', { level: 1, name: 'My Activity' })).toBeInTheDocument();
    expect(screen.getByText(/Anonymous submissions are not listed here/)).toBeInTheDocument();
  });

  it('gives each question and each booking a status in words', async () => {
    show();
    const questions = within(await screen.findByRole('region', { name: 'Questions' }));
    expect(await questions.findByText('Answered')).toBeInTheDocument();
    expect(questions.getByText('Awaiting response')).toBeInTheDocument();
    const bookings = within(screen.getByRole('region', { name: 'Consultation requests' }));
    expect(await bookings.findByText('Accepted')).toBeInTheDocument();
    expect(bookings.getByText('Requested')).toBeInTheDocument();
    expect(bookings.getByText('Declined')).toBeInTheDocument();
  });

  it('puts the private-activity note beside the anonymous card, after the two lists', async () => {
    show();
    await screen.findByRole('region', { name: 'Questions' });
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Questions', 'Consultation requests', 'Asked anonymously?']);
  });
});

describe('My activity: the tables on a wide screen', () => {
  const original = window.matchMedia;
  beforeEach(() => { window.matchMedia = vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })); });
  afterEach(() => { window.matchMedia = original; });

  it('has a table of questions with the answer or the wait in the Detail column', async () => {
    show();
    const questions = within(await screen.findByRole('region', { name: 'Questions' }));
    const table = await questions.findByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Record', 'Status', 'Detail', 'Sent']);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('Write to the landlord first.')).toBeInTheDocument();
    expect(within(table).getByText(/Awaiting an expert response/)).toBeInTheDocument();
  });

  it('has a table of consultation requests with the join link only for the accepted one', async () => {
    show();
    const bookings = within(await screen.findByRole('region', { name: 'Consultation requests' }));
    const table = await bookings.findByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Provider', 'Status', 'Booking detail', 'Action']);
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getAllByRole('link', { name: /Join the video call/ })).toHaveLength(1);
  });
});

describe('My activity: the video link', () => {
  it('says the video link opens in a new tab', async () => {
    show();
    const link = await screen.findByRole('link', { name: /Join the video call/ });
    expect(link).toHaveAccessibleName('Join the video call (opens in a new tab)');
  });
});
