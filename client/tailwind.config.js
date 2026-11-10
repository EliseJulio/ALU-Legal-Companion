import plugin from 'tailwindcss/plugin';
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Every colour points at a variable in src/index.css. Change a colour there only.
      // A colour made this way cannot take an opacity suffix such as bg-primary/30. Tailwind
      // would drop the class without any error. tests/lib/tokens.test.js checks for that.
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          text: 'var(--primary-text)',
          subtle: 'var(--primary-subtle)',
          foreground: 'var(--primary-foreground)',
        },
        // Red is for emergency only.
        alert: 'var(--alert)',
        'alert-foreground': 'var(--alert-foreground)',
        'alert-text': 'var(--alert-text)',
        // The emergency pill. Same colour as alert.
        pill: 'var(--alert)',
        'pill-foreground': 'var(--alert-foreground)',
        // Solid black or white, for urgent pills.
        inverse: 'var(--inverse)',
        'inverse-foreground': 'var(--inverse-foreground)',
        info: 'var(--info)',
        success: 'var(--success)',
        focus: 'var(--focus)',
        badge: 'var(--badge)',
        // The side navigation, the phone bar, the footer and the home page card.
        chrome: {
          DEFAULT: 'var(--chrome)',
          raised: 'var(--chrome-raised)',
          foreground: 'var(--chrome-foreground)',
        },
        'on-chrome': 'var(--on-chrome-muted)',
        ink: 'var(--ink)',
        'muted-foreground': 'var(--muted-foreground)',
        faint: 'var(--faint)',
        calm: 'var(--calm)',
        disabled: 'var(--disabled)',
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        'surface-subtle': 'var(--chrome-raised)',
        border: 'var(--border)',
        'border-soft': 'var(--border-soft)',
        // The edge of a control: field, select, chip, checkbox, destructive outline button. Always
        // 3 to 1 or more against its surface (WCAG 1.4.11). The decorative hairline is border.
        control: 'var(--border-control)',
        // Old name for the same token, kept so Landing.jsx (not edited here) still draws its fields.
        input: 'var(--border-control)',
        warning: {
          DEFAULT: 'var(--warning)',
          subtle: 'var(--warning-subtle)',
          border: 'var(--warning-border)',
          strong: 'var(--warning-strong)',
        },
      },
      // The small gap between a control and its focus ring. Tailwind's own default is white, which
      // is a bright halo on a dark page. The page colour follows the theme. A control that sits on
      // something else names its own gap colour (RING_ON_CANVAS, RING_ON_CHROME and the like).
      ringOffsetColor: { DEFAULT: 'var(--canvas)' },
      // Source Sans 3 for all text. IBM Plex Mono for counts, percentages and law citations.
      fontFamily: {
        sans: ['Source Sans 3', '-apple-system', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        head: ['Source Sans 3', '-apple-system', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['IBM Plex Mono', 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      // Four sizes only, all from src/index.css. A circle is rounded-full and is for avatars and dots.
      borderRadius: { DEFAULT: 'var(--radius-control)', card: 'var(--radius-card)', control: 'var(--radius-control)', soft: 'var(--radius-soft)', bar: 'var(--radius-bar)' },
      // Every control is at least 44 by 44 pixels so a thumb can hit it. Buttons are 44 high (the large ones 52).
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
      // Page widths from the design. Content is 1200 wide inside 48px side padding.
      maxWidth: { content: '81rem', reading: '45rem', form: '40rem' },
      width: { sidebar: '16.5rem', rail: '4.75rem', pathway: '28.75rem', route: '26.25rem' },
      // The wide layout (sidebar and top bar) starts at this width. Below it the phone
      // layout is used: a slim top bar, a bottom bar and a More sheet. lib/useMediaQuery reads
      // the same number in JavaScript, so the two must change together.
      screens: { wide: '1180px' },
      // The big heading on the front page is 68 px. Headings use a tighter line height.
      fontSize: { display: ['4.25rem', { lineHeight: '1.17' }] },
      lineHeight: { heading: '1.17' },
    },
  },
  // short: a screen under 800 px high. The open side bar trims its spacing there (MenuPanel).
  plugins: [plugin(({ addVariant }) => {
    addVariant('short', '@media (max-height: 800px)');
  })],
};
