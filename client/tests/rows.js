import { screen, waitFor } from '@testing-library/react';

// The breadcrumb is a list too. A test about the rows of a page leaves it out.
export const rows = () => screen.getAllByRole('listitem').filter((li) => !li.closest('nav'));

// Waits until at least one row is on the page. The breadcrumb is there at once so it cannot count.
export const findRows = () => waitFor(() => {
  const found = rows();
  if (found.length === 0) throw new Error('no rows yet');
  return found;
});
