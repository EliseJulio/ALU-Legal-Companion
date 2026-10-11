import { Link } from 'react-router-dom';

const RING = 'focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2';

// The five things the platform is for. Each one leads to the page where it lives.
const PILLARS = [
  { to: '/directory?category=lawyer', title: 'Lawyers', text: 'Pro-bono lawyers you can book a consultation with.' },
  { to: '/directory?category=consultant', title: 'Consultants', text: 'Offices that give free legal advice.' },
  { to: '/directory?category=organisation', title: 'Organisations', text: 'The bodies in Rwanda that handle each kind of legal problem.' },
  { to: '/where-to-go', title: 'Where to go first', text: 'Say what happened. We show which body must hear it first, with the steps and the deadline.' },
  { to: '/matters', title: 'Track your matter', text: 'Record what you have done and get a reminder before a deadline.' },
];

export default function Landing() {
  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Find the right legal help in Rwanda</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        For students and staff of African Leadership University. Everything shown here was checked
        by a legal expert against the law and the body&rsquo;s own source.
      </p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {PILLARS.map(({ to, title, text }) => (
          <li key={title} className="rounded border border-border bg-surface p-4">
            <h2 className="font-head text-base font-semibold text-primary">
              <Link to={to} className={`inline-flex min-h-touch items-center underline ${RING}`}>{title}</Link>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>

      {/* A labelled region and not role="alert". An alert is read out the moment the page
          opens and the front door should not sound an alarm on every visit. */}
      <section
        aria-labelledby="landing-urgent"
        className="mt-6 rounded border border-warning-border border-l-4 border-l-warning bg-warning-subtle p-3"
      >
        <h2 id="landing-urgent" className="font-bold text-warning-strong">If you are in danger right now</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            <a href="tel:3029" className={`inline-flex min-h-touch min-w-touch items-center gap-2 ${RING} focus-visible:ring-offset-warning-subtle`}>
              <span className="font-mono text-base font-bold text-primary">3029</span> Isange One Stop Centre
            </a>
          </li>
          <li>
            <a href="tel:112" className={`inline-flex min-h-touch min-w-touch items-center gap-2 ${RING} focus-visible:ring-offset-warning-subtle`}>
              <span className="font-mono text-base font-bold text-primary">112</span> Police
            </a>
          </li>
        </ul>
        <p className="mt-2 text-sm">
          <Link to="/emergency" className={`inline-flex min-h-touch items-center text-primary underline ${RING} focus-visible:ring-offset-warning-subtle`}>
            More urgent contacts
          </Link>
        </p>
      </section>
    </div>
  );
}
