import { useId, useState } from 'react';
import Icon from '@/components/Icon';
import { RING } from '@/lib/ui';

// The search is the name of the body plus its address. So the pin lands on the organisation.
// Nothing is stored. The link and the map are made from the checked address.
function searchFor(name, address) {
  return encodeURIComponent(`${name}, ${address}, Rwanda`);
}

// This app does not contact another site on its own. The Google map loads only after the reader
// presses the button. The Open in Google Maps link is the reader's own choice. Until then the
// page contacts nobody.
export default function MapCard({ name, address }) {
  const [shown, setShown] = useState(false);
  const panelId = useId();
  const query = searchFor(name, address);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-x-4">
        <button
          type="button"
          aria-expanded={shown}
          aria-controls={panelId}
          onClick={() => setShown((open) => !open)}
          className={`inline-flex min-h-touch items-center gap-1.5 rounded font-semibold text-primary underline ${RING}`}
        >
          <Icon name="location_on" className="text-base" />
          {/* The visible words come first in the name. The rest says which office. */}
          <span>{shown ? 'Hide map' : 'Show map'}{' '}<span className="sr-only">of {name}</span></span>
        </button>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${query}`}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex min-h-touch items-center rounded font-semibold text-primary underline ${RING}`}
        >
          Open in Google Maps{' '}<span className="sr-only">for {name} (opens in a new tab)</span>
        </a>
      </div>
      <div id={panelId}>
        {shown && (
          <iframe
            title={`Map of ${name}`}
            src={`https://maps.google.com/maps?q=${query}&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="mt-1 h-64 w-full rounded border border-border"
          />
        )}
      </div>
    </div>
  );
}
