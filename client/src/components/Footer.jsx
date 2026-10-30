import { Link } from 'react-router-dom';
import Disclaimer from '@/components/Disclaimer';
import { PUBLIC_LINKS } from '@/lib/nav';
import { RING_ON_CHROME } from '@/lib/ui';

// The footer is on every page. It holds the disclaimer. The links repeat the public menu.
// The emergency link is worded differently from the header one so each name is only used once.
const FOOTER_LINKS = [...PUBLIC_LINKS, { to: '/emergency', label: 'All emergency contacts' }];

export default function Footer() {
  return (
    <footer className="mt-10 bg-chrome text-chrome-foreground">
      <div className="px-5 py-8 md:px-12 md:py-12">
        <p className="font-head text-xl md:text-2xl">ALU Legal Companion</p>
        <p className="mt-4 text-sm text-on-chrome">For the African Leadership University community in Rwanda.</p>
        <nav aria-label="Footer" className="mt-2 flex flex-wrap gap-x-6">
          {FOOTER_LINKS.map(({ to, label }) => (
            <Link key={to} to={to} className={`flex min-h-touch items-center text-sm underline ${RING_ON_CHROME}`}>
              {label}
            </Link>
          ))}
        </nav>
        <Disclaimer onDark className="mt-2" />
        <p className="mt-1 text-xs text-on-chrome">No account is needed to browse.</p>
      </div>
    </footer>
  );
}
