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
          strong: 'var(--primary-strong)',
          subtle: 'var(--primary-subtle)',
          foreground: 'var(--primary-foreground)',
        },
        pill: 'var(--pill)',
        'pill-foreground': 'var(--pill-foreground)',
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
        disabled: 'var(--disabled)',
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        input: 'var(--border-input)',
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
      // Lora for headings and the name beside the logo. Inter for text. No other text font.
      fontFamily: {
        sans: ['Inter', '-apple-system', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        head: ['Lora', 'Georgia', 'Times New Roman', 'serif'],
        mono: ['SFMono-Regular', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      borderRadius: { DEFAULT: 'var(--radius)', md: 'var(--radius)', card: '12px', pill: '999px' },
      // Every control is at least 44 by 44 pixels so a thumb can hit it. Buttons are 48 high.
      minHeight: { touch: '44px', button: '48px' },
      minWidth: { touch: '44px' },
      // Page widths from the design. Content is 1200 wide inside 48px side padding.
      maxWidth: { content: '81rem', reading: '45rem', form: '40rem' },
      width: { sidebar: '15.75rem', rail: '5.5rem', pathway: '28.75rem', route: '26.25rem' },
      // The big heading on the front page is 68 px. Headings use a tighter line height.
      fontSize: { display: ['4.25rem', { lineHeight: '1.17' }] },
      lineHeight: { heading: '1.17' },
    },
  },
  plugins: [],
};
