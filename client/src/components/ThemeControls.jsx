import { useState } from 'react';
import Icon from '@/components/Icon';
import { nextTheme, saveTheme, themeName, useTheme } from '@/lib/theme';
import { RING, RING_ON_CANVAS, RING_ON_CHROME } from '@/lib/ui';

// The icon for each mode. Each mode also has its name, so the mode is never shown by colour alone.
const ICON = { light: 'light_mode', dark: 'dark_mode', system: 'brightness_auto' };

// Where the button sits. 'chrome' is the dark side menu. 'canvas' is the page (top bar). 'surface' is the More sheet.
// The ring gap uses the colour the button sits on so the ring does not show a halo.
const TONE = {
  chrome: { text: 'text-on-chrome hover:text-chrome-foreground', ring: RING_ON_CHROME, size: 'text-sm' },
  canvas: { text: 'text-muted-foreground hover:text-ink', ring: RING_ON_CANVAS, size: 'text-sm' },
  surface: { text: 'text-muted-foreground hover:text-ink', ring: `${RING} focus-visible:ring-offset-surface`, size: 'text-sm' },
};

// The one theme control. Each press moves Light then Dark then System then Light again.
// The button shows the icon of the current mode. With `showName` it shows the name too.
// Its label says the mode and that a press changes it.
// A polite status line says each new theme aloud.
// Only the button that was pressed says it so two buttons on one page do not both speak.
export function ThemeCycleButton({ tone = 'canvas', showName = false, className = '', onClick, ...rest }) {
  const theme = useTheme();
  const [said, setSaid] = useState('');
  const name = themeName(theme);
  const look = TONE[tone] ?? TONE.canvas;

  function press(event) {
    onClick?.(event);
    const next = nextTheme(theme);
    saveTheme(next);
    setSaid(`Theme set to ${themeName(next)}.`);
  }

  const shape = showName
    ? `inline-flex min-h-touch items-center gap-2 rounded-control px-3 ${look.size}`
    : 'grid h-11 w-11 place-items-center rounded-soft';

  // The browser's own outline is switched off so the one 2 px ring is what shows on focus.
  return (
    <>
      <button
        type="button"
        onClick={press}
        aria-label={`Theme: ${name}. Press to change.`}
        className={`${shape} shrink-0 ${look.text} ${look.ring} focus-visible:outline-none ${className}`}
        {...rest}
      >
        <Icon name={ICON[theme] ?? ICON.system} />
        {showName && name}
      </button>
      <span aria-live="polite" className="sr-only">{said}</span>
    </>
  );
}

// The button in the top bar: the same cycle, icon only.
export function ThemeButton({ className = '' }) {
  return <ThemeCycleButton tone="canvas" className={className} />;
}
