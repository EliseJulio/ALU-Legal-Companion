// One of the five parts of a guide. The text keeps its line breaks.
export default function GuideSection({ title, children }) {
  return (
    <section className="border-l-4 border-l-primary pl-3">
      <h2 className="font-head text-xs uppercase tracking-wide text-primary">{title}</h2>
      <div className="mt-1 whitespace-pre-line text-sm leading-relaxed">{children}</div>
    </section>
  );
}
