import Icon from '@/components/Icon';
import { BUTTON_OUTLINE } from '@/lib/ui';

// A button with an icon for the call controls. On a narrow screen only the icon shows.
// The words stay for screen readers. An off control gets a soft blue tint and its own icon.
export default function ControlButton({ on, onLabel, offLabel, iconOn, iconOff, onClick, disabled }) {
  const label = on ? onLabel : offLabel;
  const tint = on ? '!bg-surface' : '!bg-primary-subtle';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${BUTTON_OUTLINE} ${tint} min-w-touch disabled:opacity-60`}>
      <Icon name={on ? iconOn : iconOff} />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </button>
  );
}
