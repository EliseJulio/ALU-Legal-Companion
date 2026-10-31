import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuideHelp from '@/components/GuideHelp';

const TEXT = 'Police — 112, at any hour, if you are in immediate danger. Isange One Stop Centre — 3029, free and confidential support. Maison d\'Accès à la Justice (MAJ) — free legal aid in every district. You can also book a free first consultation with a pro-bono lawyer through this platform, or send the question to a legal expert here — anonymously if you prefer.';

const show = (text = TEXT) => render(<MemoryRouter><GuideHelp text={text} /></MemoryRouter>);

describe('GuideHelp', () => {
  it('lists each body with its name and what it does', () => {
    show();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText('Police')).toBeInTheDocument();
    expect(items[2]).toHaveTextContent('free legal aid in every district');
  });

  it('makes a phone line at the start of a detail dialable', () => {
    show();
    expect(screen.getByRole('link', { name: /^112/ })).toHaveAttribute('href', 'tel:112');
    expect(screen.getByRole('link', { name: /^3029/ })).toHaveAttribute('href', 'tel:3029');
  });

  it('puts the booking line apart with a link to the directory and to ask a question', () => {
    show();
    expect(screen.getByText(/book a free first consultation/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See the directory' })).toHaveAttribute('href', '/directory');
    expect(screen.getByRole('link', { name: 'Send a written question' })).toHaveAttribute('href', '/ask');
  });

  it('shows text that is not a list of bodies as plain paragraphs', () => {
    show('The transfer is requested on e-Tax.\n\nA private notary prepares the agreement.');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText('A private notary prepares the agreement.')).toBeInTheDocument();
  });
});
