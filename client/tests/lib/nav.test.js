import { describe, it, expect } from 'vitest';
import { navGroups, homeFor, ACCOUNT_LINK, PUBLIC_LINKS } from '@/lib/nav';

const student = { role: 'student' };
const staff = { role: 'staff' };
const expert = { role: 'legal_expert' };
const admin = { role: 'admin' };

describe('navGroups', () => {
  it('gives a visitor only the public group', () => {
    expect(navGroups(null).map((g) => g.title)).toEqual(['Explore']);
    expect(navGroups(null)[0].links).toBe(PUBLIC_LINKS);
  });

  it('gives each role its own workspace after the public group', () => {
    for (const user of [student, staff]) {
      expect(navGroups(user).map((g) => g.title)).toEqual(['Explore', 'Your workspace']);
    }
    expect(navGroups(expert).map((g) => g.title)).toEqual(['Explore', 'Expert workspace']);
    expect(navGroups(admin).map((g) => g.title)).toEqual(['Explore', 'Admin workspace']);
  });

  it('lists the pages of each workspace and never the pages of another role', () => {
    const labels = (user) => navGroups(user)[1].links.map((l) => l.label);
    expect(labels(student)).toEqual(['My Matters', 'Saved Resources', 'My Activity']);
    expect(labels(expert)).toEqual(['Questions', 'Appointments', 'Shared matters']);
    expect(labels(admin)).toEqual(['Overview', 'Guides', 'Directory entries', 'Routes', 'Checklists', 'People', 'Invitations', 'Urgent contacts']);
  });

  it('keeps /expert/questions and /admin current only on their own page', () => {
    expect(navGroups(expert)[1].links[0]).toMatchObject({ to: '/expert/questions', end: true });
    expect(navGroups(admin)[1].links[0]).toMatchObject({ to: '/admin', end: true });
  });

  it('gives every link an address and an icon name', () => {
    for (const user of [null, student, expert, admin]) {
      for (const group of navGroups(user)) {
        for (const link of group.links) {
          expect(link.to).toMatch(/^\//);
          expect(link.icon).toMatch(/^[a-z_]+$/);
          expect(link.label.length).toBeGreaterThan(0);
        }
      }
    }
    expect(ACCOUNT_LINK).toMatchObject({ to: '/settings', label: 'Account' });
  });

  it('uses a different name for every link a person can see at once', () => {
    for (const user of [null, student, expert, admin]) {
      const labels = navGroups(user).flatMap((g) => g.links.map((l) => l.label));
      if (user) labels.push(ACCOUNT_LINK.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});

describe('homeFor', () => {
  it('sends each role to its own start page and a visitor to the front door', () => {
    expect(homeFor(student)).toBe('/matters');
    expect(homeFor(staff)).toBe('/matters');
    expect(homeFor(expert)).toBe('/expert/questions');
    expect(homeFor(admin)).toBe('/admin');
    expect(homeFor(null)).toBe('/');
  });
});
