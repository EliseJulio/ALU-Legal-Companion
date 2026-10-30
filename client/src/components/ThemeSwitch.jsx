import { useState } from 'react';
import Icon from '@/components/Icon';
import { readTheme, saveTheme } from '@/lib/theme';
import { RING_ON_CHROME } from '@/lib/ui';

const OPTIONS = [
  { value: 'light', label: 'Light', icon: 'light_mode' },
  { value: 'dark', label: 'Dark', icon: 'dark_mode' },
  { value: 'system', label: 'System', icon: 'brightness_auto' },
];

// Three buttons that sit on the dark side bar. The chosen one is bold with a line under it so it
// never relies on colour. The choice is kept on this device.
export default function ThemeSwitch() {
  const [theme, setTheme] = useState(readTheme);

  function choose(value) {
    saveTheme(value);
    setTheme(value);
  }

  return (
    <div role="group" aria-label="Theme">
      <p className="px-3 text-xs font-semibold uppercase tracking-wide text-on-chrome">Theme</p>
      <div className="mt-2 grid grid-cols-3 gap-1">
        {OPTIONS.map(({ value, label, icon }) => {
          const on = theme === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() => choose(value)}
              className={`flex min-h-touch flex-col items-center justify-center gap-0.5 rounded border-b-2 px-1 text-xs ${RING_ON_CHROME} ${
                on ? 'border-chrome-foreground bg-chrome-raised font-semibold text-chrome-foreground' : 'border-transparent text-on-chrome hover:bg-chrome-raised'
              }`}
            >
              <Icon name={icon} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
