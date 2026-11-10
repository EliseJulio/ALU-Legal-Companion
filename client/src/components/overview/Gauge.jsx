// A half ring that fills with the share of documents ready. The words under it carry the number,
// so the ring is only a picture of it.
export default function Gauge({ done, total }) {
  // A total of nothing has nothing to count. A ring with nothing in it is a picture of nothing, so
  // with none ready the words stand alone.
  if (total <= 0) return null;
  const pct = Math.round((done / total) * 100);
  if (done <= 0) {
    return (
      <div>
        <p className="font-sans text-[24px] font-medium leading-tight tracking-tight text-ink">{done} of {total}</p>
        <p className="text-[13px] text-muted-foreground">documents ready</p>
      </div>
    );
  }
  return (
    <div className="relative mx-auto max-w-[300px]">
      <svg viewBox="0 0 200 116" aria-hidden="true" focusable="false" className="block h-auto w-full">
        <path
          d="M20 104A80 80 0 0 1 180 104"
          fill="none"
          strokeWidth="16"
          strokeLinecap="round"
          pathLength="100"
          className="stroke-border"
        />
        <path
          d="M20 104A80 80 0 0 1 180 104"
          fill="none"
          strokeWidth="16"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${pct} 100`}
          className="stroke-primary-text"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="font-sans text-[24px] font-medium leading-tight tracking-tight text-ink">{done} of {total}</p>
        <p className="text-[13px] text-muted-foreground">documents ready</p>
      </div>
    </div>
  );
}
