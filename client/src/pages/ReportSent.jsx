import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import TokenDisplay from '@/components/TokenDisplay';
import { BUTTON_LG_PRIMARY, BUTTON_OUTLINE, CARD, PAGE_TITLE } from '@/lib/ui';

// The page after a report is sent. The code comes in router state, is held in memory and is wiped
// from the history entry at once, so a reload cannot show it again. It is never stored anywhere.
export default function ReportSent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sent] = useState(() => location.state);
  const doneRef = useRef(null);

  useEffect(() => {
    if (!sent) return;
    navigate(location.pathname, { replace: true, state: null });
    doneRef.current?.focus();
    // Run once, when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opened by hand or reloaded: there is nothing to show.
  if (!sent || (!sent.code && !sent.email)) return <Navigate to="/report" replace />;

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }, { label: 'Report a problem', to: '/report' }]} current="Report sent" />
      <h1 className={`mt-6 ${PAGE_TITLE}`}>Report sent</h1>
      <p className="mt-4 max-w-reading text-muted-foreground">Thank you. An admin will read it.</p>

      <div className="mt-8 grid gap-6 wide:grid-cols-12">
        <div ref={doneRef} tabIndex={-1} className="min-w-0 outline-none wide:col-span-7">
          {sent.code ? (
            <>
              <TokenDisplay token={sent.code} purpose="check your report" onContinue={() => navigate('/report/check')} />
              <div className="mt-4 flex flex-wrap gap-3">
                <Link to="/report/check" className={BUTTON_OUTLINE}>Check this report</Link>
                <Link to="/guides" className={BUTTON_OUTLINE}>Back to the guides</Link>
              </div>
            </>
          ) : (
            <section className={CARD} aria-labelledby="report-mail">
              <h2 id="report-mail" className="font-head text-[20px] leading-[1.25] text-ink">We will write to you</h2>
              <p className="mt-2">
                We will email <b className="break-all">{sent.email}</b> when your report is resolved. We do not
                use the address for anything else, and we remove it once the email is sent.
              </p>
              <Link to="/guides" className={`mt-6 ${BUTTON_LG_PRIMARY}`}>Back to the guides</Link>
            </section>
          )}
        </div>
        <aside className={`min-w-0 self-start wide:col-span-5 ${CARD}`}>
          <h2 className="font-head text-[17px] leading-[1.25] text-ink">Need to add something?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Send another report and mention this one. Reports cannot be edited after they are sent.
          </p>
        </aside>
      </div>
    </div>
  );
}
