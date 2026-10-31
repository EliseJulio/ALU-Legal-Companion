import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import SideNav from '@/components/SideNav';
import { AuthProvider } from '@/lib/AuthContext';
import { saveSession, clearSession } from '@/lib/auth';

const USERS = {
  student: { id: 1, name: 'Test Student', email: 'test.student@alustudent.com', role: 'student' },
  expert: { id: 2, name: 'Test Expert', email: 'expert@example.org', role: 'legal_expert' },
  admin: { id: 3, name: 'Test Admin', email: 'admin@example.org', role: 'admin' },
};

function mount(role, path = '/') {
  clearSession();
  if (role) saveSession({ token: 'tok-1', user: USERS[role] });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider><SideNav /></AuthProvider>
    </MemoryRouter>,
  );
}

// The words of a link without its icon. The icon is hidden from a screen reader.
const nameOf = (el) =>
  [...el.childNodes]
    .filter((n) => !(n.nodeType === 1 && n.getAttribute('aria-hidden') === 'true'))
    .map((n) => n.textContent)
    .join('')
    .trim();
const nav = () => within(screen.getByRole('navigation', { name: 'Main' }));
const names = () => nav().getAllByRole('link').map(nameOf);
const current = () => nav().getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page').map(nameOf);

const EXPLORE = ['Where to Go', 'Directory', 'Legal Guides', 'Ask a legal expert'];

beforeEach(() => {
  clearSession();
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204, headers: { get: () => null } });
});

describe('SideNav: who sees what', () => {
  it('shows a visitor the four public pages and a Sign in link', () => {
    mount(null);
    expect(names()).toEqual([...EXPLORE, 'Sign in']);
    expect(nav().getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(screen.queryByText('Your workspace')).not.toBeInTheDocument();
  });

  it('gives a student their workspace, their account and Sign out', () => {
    mount('student');
    expect(names()).toEqual([...EXPLORE, 'My Matters', 'Saved Resources', 'My Activity', 'Account']);
    expect(screen.getByText('Your workspace')).toBeInTheDocument();
    expect(screen.getByText('Test Student')).toBeInTheDocument();
    expect(nav().getByRole('link', { name: 'My Matters' })).toHaveAttribute('href', '/matters');
    expect(nav().getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/settings');
    expect(nav().getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('gives a legal expert only the consultation pages and none of the admin pages', () => {
    mount('expert');
    expect(names()).toEqual([
      ...EXPLORE, 'Questions', 'Appointments', 'Shared matters', 'Account',
    ]);
    expect(nav().getByRole('link', { name: 'Shared matters' })).toHaveAttribute('href', '/expert/matters');
    expect(nav().queryByRole('link', { name: 'People' })).not.toBeInTheDocument();
    expect(nav().queryByRole('link', { name: 'My Matters' })).not.toBeInTheDocument();
  });

  it('gives an admin the management pages and none of the expert pages', () => {
    mount('admin');
    expect(names()).toEqual([
      ...EXPLORE, 'Overview', 'Guides', 'Directory entries', 'Routes', 'Checklists', 'People', 'Invitations', 'Urgent contacts', 'Account',
    ]);
    expect(nav().getByRole('link', { name: 'Invitations' })).toHaveAttribute('href', '/admin/invites');
    expect(nav().getByRole('link', { name: 'Urgent contacts' })).toHaveAttribute('href', '/admin/contacts');
    expect(nav().queryByRole('link', { name: 'Review queue' })).not.toBeInTheDocument();
  });

  it('labels the groups so a person knows which list they are in', () => {
    mount('admin');
    expect(screen.getByText('Explore')).toBeInTheDocument();
    expect(screen.getByText('Admin workspace')).toBeInTheDocument();
    // The group title and the link to the account page.
    expect(screen.getAllByText('Account')).toHaveLength(2);
  });

  it('gives every link a different name for every role', () => {
    for (const role of [null, 'student', 'expert', 'admin']) {
      const { unmount } = mount(role);
      expect(new Set(names()).size).toBe(names().length);
      unmount();
    }
  });
});

describe('SideNav: the current page', () => {
  it('marks only the current page', () => {
    mount(null, '/directory');
    expect(current()).toEqual(['Directory']);
  });

  it('still marks a section when a page below it is open', () => {
    mount(null, '/where-to-go/3');
    expect(current()).toEqual(['Where to Go']);
  });

  it('does not mark Overview or Review queue on a page below them', () => {
    const { unmount } = mount('admin', '/admin/users');
    expect(current()).toEqual(['People']);
    unmount();
    mount('expert', '/expert/questions');
    expect(current()).toEqual(['Questions']);
  });

  it('marks Overview and Questions on their own page', () => {
    const { unmount } = mount('admin', '/admin');
    expect(current()).toEqual(['Overview']);
    unmount();
    mount('expert', '/expert/questions');
    expect(current()).toEqual(['Questions']);
  });
});

describe('SideNav: the emergency link', () => {
  it('is in the banner, once, before the navigation and outside it', () => {
    mount('student');
    const chip = screen.getByRole('link', { name: 'Emergency numbers' });
    expect(chip).toHaveAttribute('href', '/emergency');
    expect(screen.getAllByRole('link', { name: 'Emergency numbers' })).toHaveLength(1);
    expect(screen.getByRole('banner')).toContainElement(chip);
    const list = screen.getByRole('navigation', { name: 'Main' });
    expect(list).not.toContainElement(chip);
    expect(chip.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is reached by keyboard after the logo and before the Menu button', async () => {
    const user = userEvent.setup({ delay: null });
    mount(null);
    await user.tab();
    // The first stop is the logo link to the front door.
    expect(screen.getByRole('link', { name: /Legal Companion/ })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Emergency numbers' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
  });
});

describe('SideNav: the menu on a small screen', () => {
  const button = () => screen.getByRole('button', { name: 'Menu' });

  it('starts closed and hides the list while closed', async () => {
    const user = userEvent.setup({ delay: null });
    mount('student');
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    const list = document.getElementById(button().getAttribute('aria-controls'));
    expect(list).toHaveClass('hidden');
    await user.click(button());
    expect(button()).toHaveAttribute('aria-expanded', 'true');
    expect(list).not.toHaveClass('hidden');
  });

  it('moves focus to the first link when it opens', async () => {
    const user = userEvent.setup({ delay: null });
    mount('student');
    await user.click(button());
    expect(nav().getAllByRole('link')[0]).toHaveFocus();
  });

  it('closes with Escape and returns focus to the Menu button', async () => {
    const user = userEvent.setup({ delay: null });
    mount('student');
    await user.click(button());
    await user.keyboard('{Escape}');
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    expect(button()).toHaveFocus();
  });

  it('closes after a link is chosen', async () => {
    const user = userEvent.setup({ delay: null });
    mount('student');
    await user.click(button());
    await user.click(nav().getByRole('link', { name: 'Legal Guides' }));
    expect(button()).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('SideNav: account and theme', () => {
  it('moves focus to the Sign in link after signing out', async () => {
    const user = userEvent.setup({ delay: null });
    mount('student');
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Sign in' })).toHaveFocus());
  });

  it('signs out and goes back to the visitor list', async () => {
    const user = userEvent.setup({ delay: null });
    mount('student');
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(names()).toEqual([...EXPLORE, 'Sign in']);
  });

  it('offers a light, a dark and a system theme with the chosen one pressed', async () => {
    const user = userEvent.setup({ delay: null });
    mount(null);
    const group = within(screen.getByRole('group', { name: 'Theme' }));
    expect(group.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(group.getByRole('button', { name: 'Dark' }));
    expect(group.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    expect(group.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await user.click(group.getByRole('button', { name: 'System' }));
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('has no link to the assistant', () => {
    mount('student');
    expect(screen.queryByRole('link', { name: /ask ai|assistant/i })).not.toBeInTheDocument();
  });
});

describe('SideNav: narrow and hide on a wide screen', () => {
  function mountMode(mode, handlers = {}) {
    clearSession();
    return render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider><SideNav mode={mode} {...handlers} /></AuthProvider>
      </MemoryRouter>,
    );
  }

  it('offers Narrow menu and Hide menu when it is open', async () => {
    const onMode = vi.fn();
    const user = userEvent.setup({ delay: null });
    mountMode('expanded', { onMode });
    await user.click(screen.getByRole('button', { name: 'Narrow menu' }));
    expect(onMode).toHaveBeenLastCalledWith('collapsed');
    await user.click(screen.getByRole('button', { name: 'Hide menu' }));
    expect(onMode).toHaveBeenLastCalledWith('hidden');
  });

  it('offers Widen menu when it is narrow and keeps every link by name', async () => {
    const onMode = vi.fn();
    const user = userEvent.setup({ delay: null });
    mountMode('collapsed', { onMode });
    expect(screen.queryByRole('button', { name: 'Narrow menu' })).not.toBeInTheDocument();
    for (const name of ['Where to Go', 'Directory', 'Legal Guides', 'Ask a legal expert']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
    await user.click(screen.getByRole('button', { name: 'Widen menu' }));
    expect(onMode).toHaveBeenLastCalledWith('expanded');
  });

  it('hides the list and offers Show menu when hidden', async () => {
    const onShow = vi.fn();
    const user = userEvent.setup({ delay: null });
    mountMode('hidden', { onShow });
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveClass('lg:hidden');
    expect(screen.queryByRole('button', { name: 'Hide menu' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show menu' }));
    expect(onShow).toHaveBeenCalled();
  });

  it('keeps the emergency numbers link, once, in every mode', () => {
    for (const mode of ['expanded', 'collapsed', 'hidden']) {
      const { unmount } = mountMode(mode);
      expect(screen.getAllByRole('link', { name: 'Emergency numbers' })).toHaveLength(1);
      unmount();
    }
  });

  it('puts the emergency link before every menu control in every mode', () => {
    for (const mode of ['expanded', 'collapsed', 'hidden']) {
      const { unmount } = mountMode(mode);
      const chip = screen.getByRole('link', { name: 'Emergency numbers' });
      const controls = screen.getAllByRole('button').filter((b) => /menu/i.test(b.textContent));
      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) {
        expect(chip.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
      unmount();
    }
  });

  it('shows a short word under every icon in the narrow bar and never hides it', () => {
    mountMode('collapsed');
    for (const name of ['Where to Go', 'Directory', 'Legal Guides', 'Ask a legal expert']) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveTextContent(name);
      expect(link.querySelector('.lg\\:sr-only')).toBeNull();
      expect(link).not.toHaveAttribute('title');
    }
  });

  it('does not call the Show, Narrow or Hide buttons expandable and does not point them at the list', () => {
    mountMode('expanded');
    for (const name of ['Narrow menu', 'Hide menu']) {
      const button = screen.getByRole('button', { name });
      expect(button).not.toHaveAttribute('aria-expanded');
      expect(button).not.toHaveAttribute('aria-controls');
    }
  });

  it('keeps aria-expanded only on the small-screen Menu button', () => {
    mountMode('hidden');
    expect(screen.getByRole('button', { name: 'Show menu' })).not.toHaveAttribute('aria-expanded');
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('tells a screen reader what changed when the menu narrows, hides and shows', async () => {
    const user = userEvent.setup({ delay: null });
    mountMode('expanded');
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('');
    await user.click(screen.getByRole('button', { name: 'Narrow menu' }));
    expect(status).toHaveTextContent('Menu narrowed');
    await user.click(screen.getByRole('button', { name: 'Hide menu' }));
    expect(status).toHaveTextContent('Menu hidden');
  });

  it('labels each group of links by its heading', () => {
    mountMode('expanded');
    expect(screen.getByRole('list', { name: 'Explore' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Account' })).toBeInTheDocument();
  });
});

describe('SideNav: the small-screen list', () => {
  function mountSmall(initial = '/') {
    clearSession();
    return render(
      <MemoryRouter initialEntries={[initial]}>
        <AuthProvider><SideNav /></AuthProvider>
      </MemoryRouter>,
    );
  }
  const menu = () => screen.getByRole('button', { name: 'Menu' });

  it('closes when a menu link is chosen and puts focus on the Menu button', async () => {
    const user = userEvent.setup({ delay: null });
    mountSmall();
    await user.click(menu());
    expect(menu()).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('link', { name: 'Legal Guides' }));
    expect(menu()).toHaveAttribute('aria-expanded', 'false');
    expect(menu()).toHaveFocus();
  });

  it('closes when another link, such as Emergency numbers, changes the page', async () => {
    const user = userEvent.setup({ delay: null });
    mountSmall();
    await user.click(menu());
    await user.click(screen.getByRole('link', { name: 'Emergency numbers' }));
    expect(menu()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup({ delay: null });
    mountSmall();
    await user.click(menu());
    await user.keyboard('{Escape}');
    expect(menu()).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('SideNav: search', () => {
  // Shows where the app went, so a test can read the address a search led to.
  function Where() {
    const location = useLocation();
    return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
  }
  function mountSearch(mode = 'expanded') {
    clearSession();
    return render(
      <MemoryRouter initialEntries={['/guides']}>
        <AuthProvider><SideNav mode={mode} /><Where /></AuthProvider>
      </MemoryRouter>,
    );
  }
  const box = () => screen.getByRole('searchbox', { name: 'Search the site' });

  it('has a search landmark with a labelled box and a Search button', () => {
    mountSearch();
    const form = screen.getByRole('search', { name: 'Site search' });
    expect(within(form).getByRole('searchbox', { name: 'Search the site' })).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Search the site' })).toBeInTheDocument();
  });

  it('keeps the search outside the list of links so the list is still only pages', () => {
    mountSearch();
    expect(nav().queryByRole('search')).not.toBeInTheDocument();
    expect(names()).toEqual([...EXPLORE, 'Sign in']);
  });

  it('opens the results page with the words typed', async () => {
    const user = userEvent.setup({ delay: null });
    mountSearch();
    await user.type(box(), 'landlord deposit');
    await user.click(screen.getByRole('button', { name: 'Search the site' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/search?q=landlord+deposit');
  });

  it('trims the words and writes special characters safely', async () => {
    const user = userEvent.setup({ delay: null });
    mountSearch();
    await user.type(box(), '  rent & deposit  {Enter}');
    expect(screen.getByTestId('where')).toHaveTextContent('/search?q=rent+%26+deposit');
  });

  it('opens the search page with no words when the box is empty', async () => {
    const user = userEvent.setup({ delay: null });
    mountSearch();
    await user.click(screen.getByRole('button', { name: 'Search the site' }));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/search$/);
  });

  it('puts a Search link in the narrow menu and hides the box from the wide bar', () => {
    mountSearch('collapsed');
    // The box stays in the page for the small-screen list. The class hides it from the wide bar.
    expect(screen.getByRole('search')).toHaveClass('lg:hidden');
    expect(screen.getByRole('link', { name: 'Search the site' })).toHaveAttribute('href', '/search');
  });

  it('shows the box on the wide open menu and hides it when the menu is hidden', () => {
    const { unmount } = mountSearch('expanded');
    expect(screen.getByRole('search')).toHaveClass('lg:block');
    unmount();
    mountSearch('hidden');
    expect(screen.getByRole('search')).toHaveClass('lg:hidden');
  });

  it('puts neither in the expanded menu as a link', () => {
    mountSearch('expanded');
    expect(screen.queryByRole('link', { name: 'Search the site' })).not.toBeInTheDocument();
  });
  it('leaves a Search link in the slim bar when the menu is hidden', () => {
    mountSearch('hidden');
    expect(screen.getByRole('link', { name: 'Search the site' })).toHaveAttribute('href', '/search');
  });

  it('empties its box after a search so it never disagrees with the address', async () => {
    const user = userEvent.setup({ delay: null });
    mountSearch();
    await user.type(box(), 'deposit{Enter}');
    expect(box()).toHaveValue('');
  });

  it('asks the results page to take focus on its heading', async () => {
    function State() {
      const { state } = useLocation();
      return <p data-testid="state">{JSON.stringify(state)}</p>;
    }
    clearSession();
    const user = userEvent.setup({ delay: null });
    render(
      <MemoryRouter initialEntries={['/guides']}>
        <AuthProvider><SideNav /><State /></AuthProvider>
      </MemoryRouter>,
    );
    await user.type(box(), 'deposit{Enter}');
    expect(screen.getByTestId('state')).toHaveTextContent('{"focusResults":true}');
  });
});
