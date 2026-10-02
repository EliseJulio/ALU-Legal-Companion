// What the assistant can read is exactly the verified guide text.
// chunkGuide is the part that splits a guide up. The database part (chunks deleted on edit,
// made again on verify) is tested in guide-integrity.test.js.
import { chunkGuide } from '../../src/services/rag.js';

const guide = {
  id: 1,
  title: 'Your rights in an unpaid internship',
  situation: 'You started an internship and have not been paid.',
  law_says: 'Article 8 of Law No. 66/2018 requires a written contract.',
  your_rights: 'You are entitled to the terms in your contract.',
  steps: 'Ask HR in writing, then contact the labour inspector.',
  get_help: 'District Labour Inspector (MIFOTRA).',
  source_law: 'Law No. 66/2018 of 30/08/2018',
};

describe('chunkGuide', () => {
  test('makes one chunk for each section of the template', () => {
    expect(chunkGuide(guide)).toHaveLength(5);
  });

  test('every chunk carries the title and the source law, so citations are precise', () => {
    for (const chunk of chunkGuide(guide)) {
      expect(chunk).toContain(guide.title);
      expect(chunk).toContain(`(Source: ${guide.source_law})`);
    }
  });

  test('each section appears in exactly one chunk', () => {
    const chunks = chunkGuide(guide);
    for (const section of ['situation', 'law_says', 'your_rights', 'steps', 'get_help']) {
      expect(chunks.filter((c) => c.includes(guide[section]))).toHaveLength(1);
    }
  });

  test('skips empty sections instead of saving blanks', () => {
    expect(chunkGuide({ ...guide, your_rights: '', steps: '   ' })).toHaveLength(3);
  });

  test('makes nothing for a guide with no sections', () => {
    expect(chunkGuide({ title: 'x', source_law: 'y' })).toEqual([]);
  });
});
