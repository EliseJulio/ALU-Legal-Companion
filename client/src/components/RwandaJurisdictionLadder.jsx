import Icon from '@/components/Icon';

// Visualizes Rwanda's dispute resolution hierarchy for civil, tenancy and community matters.
// Rooted in Law N° 37/2016 establishing the organisation, jurisdiction and competence of Abunzi committees.
export default function RwandaJurisdictionLadder({ className = '' }) {
  const tiers = [
    {
      level: '1',
      title: 'Umudugudu (Village)',
      tagline: 'Community Level',
      description: 'First informal mediation by the Village Executive Committee. Best for quick neighborhood resolutions.',
      icon: 'home',
    },
    {
      level: '2',
      title: 'Akagari (Cell Abunzi)',
      tagline: 'Mandatory First Legal Stop',
      description: 'Mandatory mediation for civil and property claims up to FRW 3,000,000 (Law N° 37/2016). Formal court cases can be dismissed if this is skipped.',
      icon: 'balance',
      highlight: true,
    },
    {
      level: '3',
      title: 'Umurenge (Sector Abunzi)',
      tagline: 'Mediation Appeals',
      description: 'Appeals against Cell Abunzi decisions must be filed here within 30 days of the ruling.',
      icon: 'account_balance',
    },
    {
      level: '4',
      title: "Urukiko rw'Ibanze (Primary Court)",
      tagline: 'Judicial Court of First Instance',
      description: 'Hears formal lawsuits if Sector Abunzi mediation fails, or for claims exceeding FRW 3,000,000.',
      icon: 'gavel',
    },
  ];

  return (
    <section aria-labelledby="rwandan-ladder-heading" className={`rounded-card border border-border bg-surface p-6 ${className}`}>
      <div className="flex items-center gap-3">
        <Icon name="balance" className="text-2xl text-primary" />
        <div>
          <h2 id="rwandan-ladder-heading" className="font-head text-2xl text-primary">
            Rwanda Dispute Ladder
          </h2>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Urwego rw'Ubuhuza n'Inkiko · Law N° 37/2016
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        In Rwanda, ordinary civil and tenancy disputes cannot jump straight to court. Follow the statutory progression below:
      </p>

      <ol className="mt-6 flex flex-col gap-4 [counter-reset:ladder]">
        {tiers.map((tier) => (
          <li
            key={tier.level}
            className={`relative rounded-card border p-4 transition-colors ${
              tier.highlight
                ? 'border-primary bg-primary-subtle'
                : 'border-border bg-surface'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-sans text-xs font-bold ${
                  tier.highlight
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted-foreground/20 text-primary'
                }`}
              >
                {tier.level}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h3 className="font-head text-lg text-primary">{tier.title}</h3>
                  <span className="text-xs font-semibold text-warning-strong">
                    {tier.tagline}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink">{tier.description}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
        <p>
          <strong className="text-primary">Important note:</strong> Disputes involving registered commercial companies or government bodies bypass Abunzi and proceed to the competent Commercial Court or MAJ.
        </p>
      </div>
    </section>
  );
}
