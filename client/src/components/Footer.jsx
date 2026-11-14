import { Link } from 'react-router-dom';
import Disclaimer from '@/components/Disclaimer';
import { PUBLIC_LINKS } from '@/lib/nav';
import { hasRole } from '@/lib/auth';
import { useOptionalUser } from '@/lib/AuthContext';
import { RING_ON_CANVAS } from '@/lib/ui';

// The footer is on every page, as a quiet line under the content. It holds the disclaimer.
// The links repeat the public menu. The emergency link is worded differently from the header one so
// each name is only used once. The layout leaves room under the page on a phone, so the bottom bar
// never covers this.
const FOOTER_LINKS = [
  ...PUBLIC_LINKS,
  { to: '/emergency', label: 'All emergency contacts' },
  { to: '/privacy', label: 'Privacy and terms' },
];

export default function Footer() {
  const user = useOptionalUser();
  // A link can name the roles that do not see it. Those roles get the rest of the list.
  const links = FOOTER_LINKS.filter((link) => !(link.hideFor && hasRole(user, link.hideFor)));
  return (
    <footer className="mt-10 border-t border-border text-ink">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 px-5 py-6 md:px-12">
        <div className="min-w-0">
          <p className="font-head text-base font-semibold">ALU Legal Companion</p>
          <p className="mt-1 text-sm text-muted-foreground">For the African Leadership University community in Rwanda.</p>
          <Disclaimer className="mt-1" />
          <p className="mt-1 text-xs text-faint">No account is needed to browse.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`inline-flex min-h-touch items-center text-sm text-muted-foreground hover:text-ink hover:underline underline-offset-4 ${RING_ON_CANVAS}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
