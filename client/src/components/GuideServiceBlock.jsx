import { useState } from 'react';
import Icon from '@/components/Icon';
import { RING } from '@/lib/ui';
import { secureAddress } from '@/lib/url';

// The "how to do it" part of a guide. The service links, who can apply, the fees, the time, the
// documents to bring, where to go and the step by step manual.
// All of it is data from the guide. Nothing here is typed into this file. A fee or an address
// written here would stay after the guide had been changed.
//
// A fact the sources could not confirm is shown as that. It is never filled in. An amount that is
// empty says so. "FRW 0" and "not published" are different things.
const LINK = `inline-flex min-h-touch items-center font-semibold text-primary underline ${RING}`;
const BUTTON = `inline-flex min-h-button items-center justify-center rounded bg-primary px-5 font-sans text-sm font-semibold text-primary-foreground ${RING}`;
const H3 = 'font-sans text-xs font-semibold uppercase tracking-wide text-primary';

const frw = (n) => `FRW ${Number(n).toLocaleString('en-US')}`;

// "2026-10-17" becomes "17 October 2026". It is read as UTC so nobody sees the day before.
function longDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// The server keeps only https links. A value that is not one makes no link at all.
function External({ href, children, className = LINK }) {
  const safe = secureAddress(href);
  if (!safe) return null;
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer" className={className}>
      {children}<span className="sr-only"> (opens in a new tab)</span> ↗
    </a>
  );
}

export default function GuideServiceBlock({ service }) {
  const [checkedDocs, setCheckedDocs] = useState({});
  if (!service) return null;
  const { portal, fees, processing, documents, offices, walkthrough, unconfirmed } = service;
  const hasBefore = portal?.url || portal?.help_url || service.who_can_apply || fees?.length || processing;

  const toggleDoc = (name) => {
    setCheckedDocs((prev) => ({ ...prev, [name]: !prev[name] }));
  };
  const packedCount = documents ? documents.filter((d) => checkedDocs[d.name]).length : 0;

  return (
    <section aria-labelledby="how-heading" className="mt-5 space-y-5 rounded border border-border bg-surface p-4">
      <h2 id="how-heading" className="font-head text-lg font-bold text-primary">How to do it</h2>

      {hasBefore && (
        <section aria-labelledby="before-heading" className="border-l-4 border-l-primary pl-3">
          <h3 id="before-heading" className={H3}>Before you start</h3>
          {(portal?.url || portal?.help_url) && (
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {portal.url && (
                <External href={portal.url} className={BUTTON}>
                  Open the service{portal.name ? ` on ${portal.name}` : ''}
                </External>
              )}
              {portal.help_url && <External href={portal.help_url}>Read the official help article</External>}
            </p>
          )}
          {(portal?.name?.toLowerCase().includes('irembo') || portal?.url?.includes('irembo.gov.rw')) && (
            <div className="mt-3 rounded border border-border bg-primary-subtle p-3 text-xs text-primary">
              <p className="font-semibold flex items-center gap-1.5">
                <Icon name="verified" className="text-sm" /> Official Rwanda Government Portal (IremboGov)
              </p>
              <p className="mt-1">
                <strong>How to pay:</strong> After submitting on Irembo, you will receive an 8-digit billing number (starts with 88...). Pay within 8 hours via <strong>MTN Mobile Money (*182*8*1#)</strong>, Airtel Money, or Bank of Kigali.
              </p>
            </div>
          )}
          <dl className="mt-2 space-y-2 text-sm">
            {service.who_can_apply && (
              <div><dt className="font-semibold">Who can apply</dt><dd>{service.who_can_apply}</dd></div>
            )}
            {fees?.length > 0 && (
              <div>
                <dt className="font-semibold">Fees</dt>
                <dd>
                  <ul className="space-y-1">
                    {fees.map((fee) => (
                      <li key={`${fee.item}-${fee.amount_rwf}`}>
                        {fee.item}: <span className="font-semibold">
                          {fee.amount_rwf === null || fee.amount_rwf === undefined ? 'not published. Ask the office' : frw(fee.amount_rwf)}
                        </span>
                        {fee.note && <span> ({fee.note})</span>}
                        {fee.source_url && <> · <External href={fee.source_url} className={`underline text-primary ${RING}`}>source</External></>}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {processing && (processing.text || processing.days_min !== undefined) && (
              <div>
                <dt className="font-semibold">How long it takes</dt>
                <dd>
                  {processing.text}
                  {!processing.text && processing.days_min !== undefined && (
                    processing.days_min === processing.days_max || processing.days_max === undefined
                      ? `${processing.days_min} days`
                      : `${processing.days_min} to ${processing.days_max} days`
                  )}
                </dd>
              </div>
            )}
            {service.checked_at && (
              <div><dt className="font-semibold">Last checked</dt><dd>{longDate(service.checked_at)}</dd></div>
            )}
          </dl>
        </section>
      )}

      {documents?.length > 0 && (
        <section aria-labelledby="needs-heading" className="border-l-4 border-l-primary pl-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="needs-heading" className={H3}>What you need</h3>
            <span className="font-mono text-xs text-muted-foreground">
              Physical dossier: {packedCount} of {documents.length} ready
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Check off each physical document as you pack your bag before visiting the office.
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {documents.map((doc) => {
              const isChecked = !!checkedDocs[doc.name];
              return (
                <li key={doc.name} className="flex items-start gap-2.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    aria-label={`Mark ${doc.name} as packed in your physical dossier`}
                    onClick={() => toggleDoc(doc.name)}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                      isChecked
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-surface hover:border-primary'
                    } ${RING}`}
                  >
                    {isChecked ? <Icon name="check" className="text-xs" /> : null}
                  </button>
                  <span className={isChecked ? 'text-muted-foreground line-through transition-all' : ''}>
                    <span className="font-semibold">{doc.name}</span>
                    {doc.required_if && <span> (only if {doc.required_if})</span>}
                    {doc.notes && <span className="block text-muted-foreground no-underline">{doc.notes}</span>}
                    {doc.where_to_get && <span className="block text-muted-foreground no-underline">Get it from: {doc.where_to_get}</span>}
                    {doc.source_url && <External href={doc.source_url} className={`text-xs underline text-primary ${RING}`}>source</External>}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 rounded border border-border bg-surface-subtle p-2.5 text-xs text-muted-foreground">
            <p className="font-semibold text-primary">Rwandan Civic Tip</p>
            <p className="mt-0.5">
              Always bring original physical documents (Passport/Alien Card, signed physical lease, or stamped certificates). Rwandan administrative offices require seeing the physical original even when an electronic copy was uploaded.
            </p>
          </div>
        </section>
      )}

      {offices?.length > 0 && (
        <section aria-labelledby="where-heading" className="border-l-4 border-l-primary pl-3">
          <h3 id="where-heading" className={H3}>Where to go</h3>
          <ul className="mt-2 space-y-3 text-sm">
            {offices.map((office) => (
              <li key={`${office.name}-${office.address}`}>
                <p className="font-semibold">{office.name}</p>
                <p>{office.address}{office.district ? `, ${office.district}` : ''}</p>
                {office.hours && <p>Open: {office.hours}</p>}
                <p className="flex flex-wrap gap-x-4">
                  {office.phone && <a href={`tel:${office.phone.replace(/[^\d+]/g, '')}`} className={LINK}>{office.phone}</a>}
                  {office.map_url && <External href={office.map_url}>Open in maps</External>}
                  {office.source_url && <External href={office.source_url}>Source</External>}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {walkthrough?.length > 0 && (
        <section aria-labelledby="steps-heading" className="border-l-4 border-l-primary pl-3">
          <h3 id="steps-heading" className={H3}>Do it online, step by step</h3>
          <ol className="mt-2 space-y-4 text-sm">
            {walkthrough.map((step, i) => (
              <li key={step.instruction} className="flex gap-3">
                <span className="mt-0.5 h-6 min-w-6 rounded bg-primary px-1.5 text-center font-mono text-xs font-medium leading-6 text-primary-foreground">{i + 1}</span>
                <div>
                  <p>{step.instruction}</p>
                  {step.url_at_step && <External href={step.url_at_step}>Open this page</External>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {unconfirmed?.length > 0 && (
        <section aria-labelledby="confirm-heading" className="rounded border border-warning-border bg-warning-subtle p-3">
          <h3 id="confirm-heading" className="font-head text-sm font-bold text-warning-strong">Ask the office to confirm</h3>
          <p className="mt-1 text-sm text-warning-strong">We could not confirm these from an official source. So they are not stated as fact:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-warning-strong">
            {unconfirmed.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      )}
    </section>
  );
}
