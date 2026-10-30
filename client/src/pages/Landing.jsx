import { Link } from 'react-router-dom';
import Icon from '@/components/Icon';
import { useApi } from '@/lib/useApi';
import { DOMAINS, readableDays } from '@/lib/directory';
import { RING_ON_CANVAS, RING_ON_WARNING, BUTTON_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

// Shown while the list loads and when it cannot be loaded. The numbers must never be missing.
const FALLBACK_CONTACTS = [
  { name: 'Isange One Stop Centre', contact: '3029' },
  { name: 'Police', contact: '112' },
];

// Only a value that a phone can dial is shown here. The full list is on the urgent help page.
const isDialable = (contact) => /^[0-9 +]+$/.test(contact.trim());

// One line for each subject. It names the subject and makes no claim about the law.
const SUBJECTS = {
  tenancy: { icon: 'home', text: 'Agreements, deposits and landlord obligations.' },
  employment: { icon: 'work', text: 'Contracts, leave and workplace protections.' },
  business: { icon: 'storefront', text: 'Starting a small business or freelancing.' },
  immigration: { icon: 'public', text: 'Permits, status and official requirements.' },
  harassment: { icon: 'shield', text: 'Reporting, boundaries and support options.' },
  vehicles: { icon: 'directions_car', text: 'Buying a car and getting a driving licence.' },
};

const PATHWAY = [
  { title: 'Your issue', text: 'Start with what happened.' },
  { title: 'Reliable information', text: 'Check the scope and the source.' },
  { title: 'Appropriate assistance', text: 'Understand where you could go next.' },
];

const REVIEW = [
  { title: 'Before publication', text: 'An administrator reviews content against official sources before it is shown.' },
  { title: 'After a significant change', text: 'Content returns for review and is temporarily hidden until it is approved again.' },
  { title: 'At the point of use', text: 'Official sources and the date of the last check are shown when available. Missing evidence is never disguised.' },
];

const labelOf = (domain) => DOMAINS.find((d) => d.value === domain)?.label ?? '';

// The inner box keeps the text in the same column as the header.
const INNER = 'mx-auto max-w-content px-5 md:px-12';
const EYEBROW = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground';
const LINK = `inline-flex min-h-touch items-center text-sm font-semibold text-info underline ${RING_ON_CANVAS}`;
// The buttons here sit on the page grey. The gap around the focus ring is that grey.
const ON_CANVAS = 'focus-visible:ring-offset-canvas';

// One band across the whole width.
function Band({ id, tone, children }) {
  return (
    <section aria-labelledby={id} className={`${tone} py-10 md:py-14`}>
      <div className={INNER}>{children}</div>
    </section>
  );
}

function Heading({ id, eyebrow, title, children }) {
  return (
    <div>
      <p className={EYEBROW}>{eyebrow}</p>
      <h2 id={id} className="mt-3 font-head text-3xl leading-heading text-primary md:text-4xl">{title}</h2>
      {children && <p className="mt-3 max-w-reading text-muted-foreground">{children}</p>}
    </div>
  );
}

export default function Landing() {
  const { data: contacts } = useApi('/emergency-contacts');
  const { data: routes, error: routesError, loading: routesLoading } = useApi('/directory/routes');
  const { data: guides } = useApi('/guides');

  // The example is the first matter that has a time limit. It is read in full from the same
  // checked route so nothing on this page is typed in by hand.
  const pick = routes?.find((r) => r.deadline_days) ?? routes?.[0];
  const { data: example } = useApi(pick ? `/directory/routes/${pick.id}` : '');
  const exampleDays = example ? readableDays(example.deadline_days) : null;

  // The numbers an administrator keeps up to date. The fixed pair stands in if there are none.
  const dialable = contacts?.filter((c) => isDialable(c.contact)).slice(0, 3);
  const urgent = dialable?.length ? dialable : FALLBACK_CONTACTS;

  return (
    <div>
      <section aria-labelledby="landing-title" className="bg-canvas py-12 md:py-16">
        <div className={`${INNER} flex flex-col gap-10 xl:flex-row xl:items-start`}>
          <div className="xl:flex-1">
            <p className={EYEBROW}>Legal information for ALU students &amp; staff</p>
            <h1 id="landing-title" className="mt-4 font-head text-4xl leading-heading text-primary sm:text-5xl 2xl:text-display">
              Understand your issue. Find your next step.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              A clearer place to begin. Explore clear information, find a possible route and
              connect with a human legal expert.
            </p>
            <p className="mt-6 flex flex-wrap gap-3">
              <Link to="/where-to-go" className={`${BUTTON_PRIMARY} ${ON_CANVAS}`}>Find Where to Go</Link>
              <Link to="/guides" className={`${BUTTON_OUTLINE} ${ON_CANVAS}`}>Explore Legal Guides</Link>
            </p>
            <p className="mt-4 text-xs text-muted-foreground">Browse without an account. Your personal matters stay private.</p>
          </div>

          <aside aria-labelledby="landing-pathway" className="rounded-2xl bg-chrome p-8 text-chrome-foreground xl:w-96 xl:shrink-0 2xl:w-pathway">
            <p className="text-xs font-semibold uppercase tracking-wide text-on-chrome">A pathway, not a promise</p>
            <h2 id="landing-pathway" className="mt-4 font-head text-3xl leading-heading">Clarity comes one step at a time.</h2>
            {/* On a tablet the card is full width, so the three steps sit in three columns as in the design. */}
            <ol role="list" className="mt-6 flex flex-col gap-6 md:max-xl:grid md:max-xl:grid-cols-3">
              {PATHWAY.map(({ title, text }, i) => (
                <li key={title} className="flex gap-4 md:max-xl:flex-col md:max-xl:gap-3">
                  <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-input font-head text-xl text-on-chrome">
                    0{i + 1}
                  </span>
                  <span>
                    <span className="block font-semibold">{title}</span>
                    <span className="block text-sm text-on-chrome">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-xs text-on-chrome">Pre-authored routes · Conventional search · Human experts</p>
          </aside>

          {/* The menu has the search box on a wide screen. Where the menu is closed this card leads to it. */}
          <section aria-labelledby="landing-search" className="rounded-card border border-border bg-surface p-6 xl:hidden">
            <h2 id="landing-search" className="font-head text-2xl leading-heading text-primary">Search guides or routes</h2>
            <p className="mt-2 text-sm text-muted-foreground">Choose a library, then search its available issue and topic fields.</p>
            <Link to="/search" className={`${BUTTON_OUTLINE} mt-4 w-full`}>
              Choose where to search<span aria-hidden="true">&nbsp;→</span>
            </Link>
          </section>
        </div>
      </section>

      {/* The six subjects the guides cover. The whole card is one link to the library on that subject. */}
      <Band id="landing-subjects" tone="bg-surface">
        <Heading id="landing-subjects" eyebrow="Start with your situation" title="Everyday questions. A more informed start." />
        <ul className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {DOMAINS.map(({ value, label }) => {
            const subject = SUBJECTS[value];
            const glyph = subject?.icon ?? 'public';
            return (
              // From sm up each subject is a card. On a phone it is a compact row, as in the design:
              // the name and an arrow. The whole row is the link and its name is still "Explore …".
              <li
                key={value}
                className="relative flex items-center justify-between gap-4 rounded border-b border-border py-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-canvas sm:flex-col sm:items-stretch sm:justify-start sm:rounded-card sm:border sm:bg-surface sm:p-6"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span aria-hidden="true" className="hidden h-12 w-12 shrink-0 place-items-center rounded-card bg-canvas text-primary sm:grid">
                    <Icon name={glyph} className="text-xl" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-head text-2xl text-primary">{label}</h3>
                    {subject && <p className="hidden text-xs text-muted-foreground sm:block">{subject.text}</p>}
                  </div>
                </div>
                <Link
                  to={`/guides?domain=${value}`}
                  className={`${BUTTON_OUTLINE} after:absolute after:inset-0 max-sm:min-h-touch max-sm:min-w-touch max-sm:border-0 max-sm:bg-transparent max-sm:px-0 max-sm:py-0 sm:mt-auto sm:w-full`}
                >
                  <span className="sr-only sm:not-sr-only">Explore {label}</span>
                  <span aria-hidden="true" className="text-xl sm:hidden">↗</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Band>

      {/* One checked route in full. Until an admin has checked a route this says so. It never
          shows a made-up one. The front door shows no error. It says what happened and points on. */}
      {!routesLoading && (
        <Band id="landing-route" tone="bg-canvas">
          <Heading id="landing-route" eyebrow="From the directory" title="Not sure which office to approach?">
            A route brings the office, its limits and the steps together before you decide what to do.
          </Heading>

          {example ? (
            <div className="mt-8 flex flex-col gap-10 xl:flex-row xl:items-start">
              <div className="flex flex-col gap-4 xl:flex-1">
                <h3 className="font-head text-3xl leading-heading text-primary">{example.title}</h3>
                <p>
                  Go first to: <span className="font-semibold">{example.first_forum.name}</span>
                </p>
                {/* Plain text. Some routes name a body and not an article. */}
                <p className="line-clamp-3 text-sm text-ink">{example.legal_basis}</p>
                <ol className="border-t border-border">
                  {example.steps.slice(0, 3).map((step, i) => (
                    <li key={step} className="flex gap-4 border-b border-border py-4">
                      <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
                        0{i + 1}
                      </span>
                      <span className="text-sm">{step}</span>
                    </li>
                  ))}
                </ol>
                <p className={`text-sm ${exampleDays ? 'font-semibold text-warning-strong' : 'text-muted-foreground'}`}>
                  {exampleDays ? `Time limit: ${exampleDays} from ${example.deadline_runs_from}` : 'No deadline recorded'}
                </p>
              </div>

              <aside aria-labelledby="landing-next" className="flex flex-col gap-5 rounded-2xl border border-primary bg-surface p-8 xl:w-route xl:shrink-0">
                <p className={EYEBROW}>Recommended next step</p>
                <h3 id="landing-next" className="font-head text-3xl leading-heading text-primary">Read the route before you act</h3>
                <p className="text-sm text-ink">
                  A route names the office to go to first, the law that sends you there and the steps in order.
                </p>
                <Link to={`/where-to-go/${example.id}`} className={`${BUTTON_PRIMARY} w-full`}>Read this route in full</Link>
                <p className="text-xs text-muted-foreground">A route is a starting point. It does not promise an outcome.</p>
              </aside>
            </div>
          ) : (
            routes && routes.length === 0 && (
              <p className="mt-8 rounded-card border border-border bg-surface p-6 text-sm text-muted-foreground">
                No matter has been verified yet. Each one appears here only after an admin has
                checked and published it. Until then the free legal aid office in your district can tell you where to start.{' '}
                <Link to="/directory" className={LINK}>See the directory</Link>
              </p>
            )
          )}
          {routesError && (
            <p className="mt-8 rounded-card border border-border bg-surface p-6 text-sm text-muted-foreground">
              We could not load the matters just now. The directory and the urgent numbers still work.
            </p>
          )}
        </Band>
      )}

      {/* Up to four checked guides. Each card shows its summary when it has one and the law it rests on. */}
      <Band id="landing-guides" tone="bg-surface">
        <Heading id="landing-guides" eyebrow="Understand" title="Read for your situation, not a law number.">
          Guides in simple words, each checked against the law before it is published. Official references stay as supporting detail.
        </Heading>
        {guides?.length > 0 && (
          <ul className="mt-7 grid gap-4 md:grid-cols-2">
            {guides.slice(0, 4).map((g) => (
              <li key={g.id} className="relative flex flex-col gap-4 rounded-card border border-border bg-surface p-6 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-canvas">
                <p className="text-xs font-semibold text-muted-foreground">{labelOf(g.domain)}</p>
                <h3 className="font-head text-2xl leading-heading text-primary">
                  <Link to={`/guides/${g.id}`} className={`hover:underline after:absolute after:inset-0 ${RING_ON_CANVAS}`}>{g.title}</Link>
                </h3>
                {g.summary && <p className="text-sm text-muted-foreground">{g.summary}</p>}
                <p className="w-fit rounded bg-primary-subtle px-2 py-0.5 font-mono text-xs text-primary">{g.source_law}</p>
                <span aria-hidden="true" className="text-sm font-semibold text-primary underline">Read guide →</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4"><Link to="/guides" className={LINK}>Explore all Legal Guides<span aria-hidden="true">&nbsp;→</span></Link></p>
      </Band>

      <Band id="landing-people" tone="bg-canvas">
        <Heading id="landing-people" eyebrow="Speak to a person" title="You don’t have to work it out alone." />
        <ul className="mt-7 grid gap-4 md:grid-cols-2">
          <li className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
            <div className="flex items-center gap-4">
              <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-card bg-canvas text-primary">
                <Icon name="calendar_clock" className="text-xl" />
              </span>
              <div>
                <h3 className="font-head text-2xl leading-heading text-primary">Request a consultation</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  For eligible listings, request a date and time. The provider must accept before it becomes an appointment.
                </p>
              </div>
            </div>
            <Link to="/directory" className={`${BUTTON_PRIMARY} mt-auto w-full`}>Find assistance in the Directory</Link>
          </li>
          <li className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6">
            <div className="flex items-center gap-4">
              <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-card bg-canvas text-primary">
                <Icon name="chat_bubble" className="text-xl" />
              </span>
              <div>
                <h3 className="font-head text-2xl leading-heading text-primary">Ask a legal expert</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Send a written question to a human expert. You can ask anonymously. Keep the one-time code to read the response.
                </p>
              </div>
            </div>
            <Link to="/ask" className={`${BUTTON_OUTLINE} mt-auto w-full`}>Ask a legal expert</Link>
          </li>
        </ul>
      </Band>

      <Band id="landing-review" tone="bg-primary-subtle">
        <Heading id="landing-review" eyebrow="What review should mean" title="Trust is a visible record." />
        <ul className="mt-7 grid gap-4 xl:grid-cols-3">
          {REVIEW.map(({ title, text }) => (
            <li key={title} className="rounded-card border border-border bg-surface p-6">
              <h3 className="font-semibold text-ink">{title}</h3>
              <p className="mt-3 text-sm text-ink">{text}</p>
            </li>
          ))}
        </ul>
      </Band>

      {/* A labelled region and not role="alert". An alert is read out the moment the page
          opens. The front door should not sound an alarm on every visit. */}
      <Band id="landing-urgent" tone="bg-canvas">
        <div className="flex flex-col gap-4 rounded border border-warning-border border-l-4 border-l-warning bg-warning-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="landing-urgent" className="font-semibold text-warning-strong">In danger, or has someone hurt you?</h2>
            <p className="mt-1 text-sm text-ink">Do not wait for a written response. Call now.</p>
            <ul className="mt-2 flex flex-wrap gap-x-6 text-sm">
              {urgent.map((c) => (
                <li key={c.name}>
                  <a href={`tel:${c.contact.replace(/\s+/g, '')}`} className={`inline-flex min-h-touch min-w-touch items-center gap-2 ${RING_ON_WARNING}`}>
                    {c.name}: <span className="font-mono text-base font-bold text-primary">{c.contact}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <Link to="/emergency" className={`${BUTTON_OUTLINE} focus-visible:ring-offset-warning-subtle`}>See all emergency contacts</Link>
        </div>
      </Band>

      <section aria-labelledby="landing-start" className="bg-canvas pb-12 pt-4 md:pb-16">
        <div className={INNER}>
          <div className="border-t border-border pt-10">
            <h2 id="landing-start" className="font-head text-3xl leading-heading text-primary md:text-5xl">
              A good next step starts with a clearer question.
            </h2>
            <p className="mt-4 text-muted-foreground">Choose your situation. Read the context. Decide what to check next.</p>
            <Link to="/where-to-go" className={`${BUTTON_PRIMARY} mt-6 ${ON_CANVAS}`}>Find Where to Go</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
