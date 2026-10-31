import { describe, it, expect } from 'vitest';
import { parseHelp } from '@/lib/helpList';

const HARASSMENT = 'Police — 112, at any hour, if you are in immediate danger. Isange One Stop Centre — 3029, free and confidential support including medical, psychosocial and legal help, particularly where there is gender-based violence or an intimate-partner element. Rwanda Investigation Bureau (RIB) — the office that takes criminal complaints; there is one for your sector. Your institution\'s student support, counselling or dean of students — especially if the person is another student or a member of staff. Maison d\'Accès à la Justice (MAJ) — free legal aid in every district. You can also book a free first consultation with a pro-bono lawyer through this platform, or send the question to a legal expert here — anonymously if you would rather not give your name.';

// The "Where to get help" part of a guide is stored as one paragraph of "Name — what they do."
// The page shows it as a list of bodies. Anything it cannot read that way stays as plain text.
describe('parseHelp', () => {
  it('turns each "Name — detail." sentence into one contact and keeps the platform line apart', () => {
    const blocks = parseHelp(HARASSMENT);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('contacts');
    expect(blocks[0].items.map((i) => i.name)).toEqual([
      'Police',
      'Isange One Stop Centre',
      'Rwanda Investigation Bureau (RIB)',
      "Your institution's student support, counselling or dean of students",
      "Maison d'Accès à la Justice (MAJ)",
    ]);
    expect(blocks[0].items[0].detail).toBe('112, at any hour, if you are in immediate danger.');
    expect(blocks[1]).toEqual({ type: 'platform', text: expect.stringMatching(/^You can also book a free first consultation/) });
  });

  it('joins a sentence that has no dash to the contact before it', () => {
    const [list] = parseHelp('Isange One Stop Centre — 3029. Free, 24 hours: medical care and evidence collection. Rwanda National Police — 112 for emergencies. Maison d\'Accès à la Justice (MAJ) — free legal aid in every district.');
    expect(list.items[0].detail).toBe('3029. Free, 24 hours: medical care and evidence collection.');
    expect(list.items).toHaveLength(3);
  });

  it('keeps a web address inside a name', () => {
    const [list] = parseHelp('Irembo (irembo.gov.rw) — where the applications live. Maison d\'Accès à la Justice (MAJ) — free legal aid in every district.');
    expect(list.items[0].name).toBe('Irembo (irembo.gov.rw)');
  });

  it('leaves text that is not a list of bodies as plain paragraphs', () => {
    const text = 'Rwanda Revenue Authority (RRA): the transfer is requested on e-Tax.\n\nA private notary prepares the sale agreement.';
    expect(parseHelp(text)).toEqual([
      { type: 'text', text: 'Rwanda Revenue Authority (RRA): the transfer is requested on e-Tax.' },
      { type: 'text', text: 'A private notary prepares the sale agreement.' },
    ]);
  });

  it('gives nothing for empty text', () => {
    expect(parseHelp('')).toEqual([]);
    expect(parseHelp(undefined)).toEqual([]);
  });
});
