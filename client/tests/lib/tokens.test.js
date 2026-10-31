import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { URL as NodeURL, fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

const css = readFileSync(new NodeURL('../../src/index.css', import.meta.url), 'utf8');
const tailwindConfig = readFileSync(new NodeURL('../../tailwind.config.js', import.meta.url), 'utf8');
const srcDir = fileURLToPath(new NodeURL('../../src', import.meta.url));

function collectSourceFiles(dir) {
  let files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files = files.concat(collectSourceFiles(full));
    } else if (['.js', '.jsx'].includes(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

// The tokens of one block as { name: value }.
const vars = (block) => Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const light = vars(css.match(/:root\s*\{([^}]*)\}/)[1]);
const dark = vars(css.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/)[1]);
const darkFromDevice = vars(css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/)[1]);

// Contrast of two colours by the WCAG 2.1 formula.
function contrast(a, b) {
  const luminance = (hex) => {
    const c = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [l1, l2] = [luminance(a), luminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// [what it is, text or shape colour, the colour behind it, the smallest ratio]. 4.5 is for text.
// 3 is for the edge of a control and the focus ring.
const pairs = (t) => [
  ['body text on the page', t.ink, t.canvas, 4.5],
  ['body text on a card', t.ink, t.surface, 4.5],
  ['muted text on the page', t['muted-foreground'], t.canvas, 4.5],
  ['muted text on a card', t['muted-foreground'], t.surface, 4.5],
  ['headings and links in the main colour on the page', t.primary, t.canvas, 4.5],
  ['headings and links in the main colour on a card', t.primary, t.surface, 4.5],
  ['text on a tinted band', t.primary, t['primary-subtle'], 4.5],
  ['text on a main button', t['primary-foreground'], t.primary, 4.5],
  ['text on a disabled button', t['primary-foreground'], t.disabled, 4.5],
  ['info links on the page', t.info, t.canvas, 4.5],
  ['info links on a card', t.info, t.surface, 4.5],
  ['crimson text on the page', t.warning, t.canvas, 4.5],
  ['crimson text on a card', t.warning, t.surface, 4.5],
  ['strong crimson text on the alert tint', t['warning-strong'], t['warning-subtle'], 4.5],
  ['success text on a card', t.success, t.surface, 4.5],
  ['emergency pill text on the pill', t['pill-foreground'], t.pill, 4.5],
  ['text on the side bar', t['chrome-foreground'], t.chrome, 4.5],
  ['muted text on the side bar', t['on-chrome-muted'], t.chrome, 4.5],
  ['text on the raised side bar', t['chrome-foreground'], t['chrome-raised'], 4.5],
  ['muted text on the raised side bar', t['on-chrome-muted'], t['chrome-raised'], 4.5],
  ['field border on a card', t['border-input'], t.surface, 3],
  ['field border on the page', t['border-input'], t.canvas, 3],
  ['focus ring on the page', t.focus, t.canvas, 3],
  ['focus ring on a card', t.focus, t.surface, 3],
  ['focus ring on the side bar', t['chrome-foreground'], t.chrome, 3],
  ['emergency pill against the side bar', t.pill, t.chrome, 3],
];

describe('design tokens: the palette', () => {
  it('uses the Figma palette in the light theme', () => {
    expect(light.primary).toBe('#132c43');
    expect(light.canvas).toBe('#f7f5ef');
    expect(light.ink).toBe('#213547');
    expect(light.warning).toBe('#a52d40');
    expect(light.info).toBe('#345f83');
    expect(light.success).toBe('#276449');
    expect(light.focus).toBe('#397db2');
  });

  it('shows that crimson on navy fails so nobody tries it', () => {
    expect(contrast(light.warning, light.chrome)).toBeLessThan(3);
  });

  it('defines every token in both themes', () => {
    const names = Object.keys(light).filter((n) => n !== 'radius');
    expect(names.filter((n) => !(n in dark))).toEqual([]);
    expect(Object.keys(dark).filter((n) => !(n in light))).toEqual([]);
  });

  it('gives the dark theme the same values whether the device or a person chose it', () => {
    expect(darkFromDevice).toEqual(dark);
  });

  it('writes a colour only in the tokens of this file', () => {
    const allowed = new Set([...Object.values(light), ...Object.values(dark), ...Object.values(darkFromDevice)]
      .filter((v) => /^#[0-9a-f]{6}$/i.test(v)).map((v) => v.toLowerCase()));
    const stray = (css.match(/#[0-9a-f]{6}/gi) ?? []).map((h) => h.toLowerCase()).filter((h) => !allowed.has(h));
    expect(stray).toEqual([]);
  });

  it('defines every variable that the Tailwind config uses', () => {
    const used = [...tailwindConfig.matchAll(/var\(--([a-z-]+)\)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(10);
    expect(used.filter((name) => !(name in light))).toEqual([]);
  });

  it('keeps raw colours out of the components', () => {
    const offenders = [];
    for (const file of collectSourceFiles(srcDir).filter((f) => !/\.test\.jsx?$/.test(f))) {
      const found = readFileSync(file, 'utf8').match(/#[0-9a-f]{6}\b|\brgba?\(|\bhsla?\(/gi);
      if (found) offenders.push(`${file}: ${found.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  // Tailwind drops a class such as bg-primary/30 without any error when the colour is a plain
  // variable. The element then falls back to a pale grey. This looks for that mistake.
  it('never puts an opacity suffix on a project colour', () => {
    const pattern = /-(primary|warning|ink|surface|canvas|border|input|info|success|focus|badge|chrome|on-chrome|pill)[a-z-]*\/\d+/g;
    const offenders = [];
    for (const file of collectSourceFiles(srcDir).filter((f) => !/\.test\.jsx?$/.test(f))) {
      const matches = readFileSync(file, 'utf8').match(pattern);
      if (matches) offenders.push(`${file}: ${matches.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe.each([
  ['light', light],
  ['dark', dark],
])('design tokens: contrast in the %s theme', (_name, theme) => {
  it.each(pairs(theme))('%s', (_what, fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});
