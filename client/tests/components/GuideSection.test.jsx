import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import GuideSection from '@/components/GuideSection';

describe('GuideSection', () => {
  it('shows numbered steps as an ordered list with bold numbers', () => {
    render(<GuideSection id="guide-steps" title="Steps to take">{'1. Do not reply. 2. Do NOT delete the messages. 3. Write a note.'}</GuideSection>);
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
    expect(list.className).toContain('marker:font-bold');
    const items = within(list).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['Do not reply.', 'Do NOT delete the messages.', 'Write a note.']);
  });

  it('leaves ordinary text as one block', () => {
    render(<GuideSection id="guide-law" title="What the law says">{'Article 24 sets the notice. It is 15 days.'}</GuideSection>);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText(/Article 24 sets the notice/)).toBeInTheDocument();
  });
});
