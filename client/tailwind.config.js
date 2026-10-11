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
      fontFamily: {
        sans: ['-apple-system', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        head: ['Montserrat', '-apple-system', 'system-ui', 'sans-serif'],
        mono: ['SFMono-Regular', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      borderRadius: { DEFAULT: 'var(--radius)', md: 'var(--radius)' },
      // Every control is at least 44 by 44 pixels so a thumb can hit it.
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
    },
  },
  plugins: [],
};
