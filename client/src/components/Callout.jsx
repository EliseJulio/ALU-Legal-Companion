// A short note beside the main content. The bar on the left and the words carry the meaning,
// so it still reads in a greyscale screenshot. It is a plain block and not an alert, so a
// screen reader does not announce it on every visit.
export default function Callout({ title, children, className = '' }) {
  return (
    <div className={`border-l-4 border-info bg-primary-subtle p-4 text-sm ${className}`}>
      {title && <p className="font-semibold text-primary">{title}</p>}
      <div className={title ? 'mt-1' : ''}>{children}</div>
    </div>
  );
}
