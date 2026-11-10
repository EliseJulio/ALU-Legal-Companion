import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import Icon from '@/components/Icon';
import { CARD, PAGE_TITLE, BUTTON_OUTLINE } from '@/lib/ui';

// One place to start when a person has a code and does not remember which kind. A question
// code and a booking code open two different pages, so this page only sends the reader on. It
// asks for no code itself. A code is typed on the page that uses it and never goes in an address.
export default function CheckRequest() {
  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="Check an anonymous request" />
      <h1 className={`mt-6 ${PAGE_TITLE}`}>Check an anonymous request</h1>
      <p className="mt-3 max-w-reading text-muted-foreground">
        Asked a question or asked for a consultation without an account? Choose what you asked
        for, then type the code you saved. Lost codes cannot be recovered or reissued.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className={CARD} aria-labelledby="question-lookup">
          <Icon name="chat_bubble" className="text-2xl text-primary-text" />
          <h2 id="question-lookup" className="mt-2 font-head text-[20px] leading-[1.25] text-ink">A question</h2>
          <p className="mt-2 text-sm text-muted-foreground">Read the answer from a legal expert or see that it is still waiting.</p>
          <Link to="/ask/check" className={`${BUTTON_OUTLINE} mt-4`}>Check a question</Link>
        </section>
        <section className={CARD} aria-labelledby="booking-lookup">
          <Icon name="calendar_month" className="text-2xl text-primary-text" />
          <h2 id="booking-lookup" className="mt-2 font-head text-[20px] leading-[1.25] text-ink">A consultation request</h2>
          <p className="mt-2 text-sm text-muted-foreground">See whether the lawyer accepted the time and how to join.</p>
          <Link to="/directory/booking-check" className={`${BUTTON_OUTLINE} mt-4`}>Check a booking</Link>
        </section>
      </div>
    </div>
  );
}
