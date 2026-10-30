// The disclaimer line. On a navy bar it needs light text. The grey would not be readable.
export default function Disclaimer({ className = '', onDark = false }) {
  const tone = onDark ? 'text-on-chrome' : 'italic text-muted-foreground';
  return (
    <p className={`text-xs ${tone} ${className}`}>
      Legal information not legal advice.
    </p>
  );
}
