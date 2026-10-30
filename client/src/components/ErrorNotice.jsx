// For an ordinary failure such as a dropped request on campus wifi or a server error.
// It must not look like the crisis block. The crisis block is filled and has a red rule on
// the left. It means "if you are in danger right now". If every failure looked like the crisis block it would stop standing out.
// `error.message` is the server's own wording and is shown as it is.
export default function ErrorNotice({ error, className = '', id }) {
  return (
    <p id={id} role="alert" className={`rounded border border-border bg-surface p-3 text-warning-strong ${className}`}>
      {error.message}
    </p>
  );
}
