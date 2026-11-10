import Icon from '@/components/Icon';

// The one dropdown. It is still the browser's own select, so the keyboard and the screen reader
// work as they always did. The native arrow is hidden and an icon is drawn 12 px from the right
// edge. The right padding (40 px) leaves 12 px between the longest text and the icon, so a select
// that sizes to its content has the arrow close to the words. `className` styles the select,
// `wrapperClassName` places it (margin, width). Give a full width select `w-full` in `className`
// and `flex` in `wrapperClassName`. The default wrapper is as wide as the select.
export default function Select({ className = '', wrapperClassName = '', children, ...props }) {
  return (
    <span className={`relative inline-flex max-w-full ${wrapperClassName}`}>
      <select {...props} className={`${className} !mt-0 appearance-none !pr-10`}>{children}</select>
      <Icon name="chevron_down" size="16px" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
    </span>
  );
}
