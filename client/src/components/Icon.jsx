// One line icon. It is decoration. The words next to it carry the meaning.
// `name` is the app's own name, such as "menu". lib/icons.js maps each name to a lucide icon.
import { ICONS } from '@/lib/icons';

// The one place the icon size is set. About 15 px on a phone and 17 px on a desktop. A `size` prop
// overrides it.
export const ICON_SIZE = 'clamp(15px, calc(1.1vw + 9px), 17px)';

export default function Icon({ name, className = '', size = ICON_SIZE }) {
  // hasOwn, so a name such as "constructor" is not read from the object's own prototype.
  if (!Object.hasOwn(ICONS, name)) {
    if (import.meta.env.DEV) console.warn(`Icon: there is no icon called "${name}".`);
    return null;
  }
  const Glyph = ICONS[name];
  return (
    <Glyph
      aria-hidden="true"
      focusable="false"
      data-icon={name}
      strokeWidth={1.5}
      style={{ width: size, height: size }}
      className={`shrink-0 ${className}`}
    />
  );
}
