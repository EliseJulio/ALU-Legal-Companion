// A full ring that fills with the share of documents ready. It starts at the top and fills clockwise.
// The words in the middle carry the number so the ring is only a picture of it.
export default function Gauge({ done, total }) {
  // A total of nothing has nothing to count. A ring with nothing in it is a picture of nothing, so
  // with none ready the words stand alone.
  if (total <= 0) return null;
  const pct = Math.min(100, Math.round((done / total) * 100));
  if (done <= 0) {
    return (
      <div>
        <p className="font-sans text-[24px] font-medium leading-tight tracking-tight text-ink">{done} of {total}</p>
        <p className="text-[13px] text-muted-foreground">documents ready</p>
      </div>
    );
  }
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[220px]">
      <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false" className="block h-full w-full">
        <circle cx="100" cy="100" r="84" fill="none" strokeWidth="16" className="stroke-border" />
        <circle
          cx="100"
          cy="100"
          r="84"
          fill="none"
          strokeWidth="16"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${pct} 100`}
          transform="rotate(-90 100 100)"
          className="stroke-primary-text"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="font-sans text-[28px] font-medium leading-tight tracking-tight text-ink">{done} of {total}</p>
        <p className="text-[13px] text-muted-foreground">documents ready</p>
      </div>
    </div>
  );
}
