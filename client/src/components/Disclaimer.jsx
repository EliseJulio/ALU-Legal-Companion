export default function Disclaimer({ className = '' }) {
  return (
    <p className={`text-xs italic text-muted-foreground ${className}`}>
      Legal information not legal advice.
    </p>
  );
}
