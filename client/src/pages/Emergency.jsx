import { useApi } from '@/lib/useApi';
import CrisisAlert from '@/components/CrisisAlert';
import ErrorNotice from '@/components/ErrorNotice';

// The contact list has phone numbers such as 112 and 3029. It also has a website and a line of
// text such as "Nearest district office". Only a value that a phone can dial becomes a link.
const isDialable = (contact) => /^[0-9 +]+$/.test(contact.trim());

export default function Emergency() {
  const { data: contacts, error, loading } = useApi('/emergency-contacts');

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Urgent help</h1>
      {/* CrisisAlert is fixed text. 3029 and 112 are on the page even if the request fails. */}
      <div className="mt-4"><CrisisAlert /></div>

      {loading && <p className="mt-4 text-muted-foreground">Loading contacts…</p>}
      {error && <ErrorNotice error={error} className="mt-4" />}

      <ul className="mt-4 space-y-3">
        {contacts?.map((c) => (
          <li key={c.name} className="rounded border border-border bg-surface p-4">
            <h2 className="font-head text-base font-semibold text-primary">{c.name}</h2>
            {isDialable(c.contact) ? (
              <a
                href={`tel:${c.contact.replace(/\s+/g, '')}`}
                className="mt-1 inline-flex min-h-touch min-w-touch items-center font-mono text-sm text-primary underline focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2"
              >
                {c.contact}
              </a>
            ) : (
              <p className="mt-1 font-mono text-sm text-primary">{c.contact}</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">{c.when}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
