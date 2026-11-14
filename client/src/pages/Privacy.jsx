import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import Disclaimer from '@/components/Disclaimer';
import { PAGE_TITLE, RING_ON_CANVAS } from '@/lib/ui';

const H2 = 'font-head text-[20px] leading-[1.25] text-ink';
const LINK = `rounded-control font-semibold text-info underline ${RING_ON_CANVAS}`;

// One block of the page: a heading and plain paragraphs or a list under it.
function Section({ id, title, children }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className={H2}>{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

// The privacy and terms page. It is public. It states what the platform does with personal
// information and nothing more than that.
export default function Privacy() {
  return (
    <div className="max-w-reading">
      <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="Privacy and terms" />
      <h1 className={`mt-6 ${PAGE_TITLE}`}>Privacy and terms</h1>
      <p className="mt-4 text-muted-foreground">
        This page says what we collect, who can see it and what you can do about it. We keep it short and plain.
      </p>

      <Section id="collect" title="What we collect">
        <p>When you create an account we keep your name and email address. Your password is stored only as a hash, so nobody can read it.</p>
        <p>We also keep what you choose to add: your matters, their dates and your documents, the questions you send and your appointment bookings.</p>
        <p>We do not collect a phone number, a home address or a student number.</p>
      </Section>

      <Section id="anonymous" title="Anonymous questions and bookings">
        <p>An anonymous question or booking stores no name, no email and no account.</p>
        <p>It is tied only to a random code that is shown once. We store the code only in scrambled (hashed) form. If you lose it, it cannot be recovered.</p>
      </Section>

      <Section id="ask-ai" title="Ask AI">
        <p>Ask AI answers only from published guides. Nothing is stored: there is no chat log and no identity.</p>
        <p>Your question is sent to Google&apos;s Gemini service. That is why you must tick &quot;I understand&quot; before anything is sent.</p>
        <p>AI answers may be wrong. They are legal information, not legal advice.</p>
      </Section>

      <Section id="documents" title="Documents, sharing and reminders">
        <p>Documents you add to a matter are stored encrypted. Only you, and a lawyer you share that matter with, can open them.</p>
        <p>You can end sharing at any time. Reminder emails say only the date.</p>
      </Section>

      <Section id="video" title="Video consultations">
        <p>Nothing is recorded.</p>
        <p>
          A call goes straight between your browser and the lawyer&apos;s browser. Our signaling service on Cloudflare only helps
          the two connect. It sees a random room name and your network address.
        </p>
        <p>
          If a direct route is not possible Cloudflare relays the call and it stays encrypted. If our own call cannot start we use
          Daily or the lawyer&apos;s Google Meet link instead.
        </p>
      </Section>

      <Section id="where" title="Where your data is held">
        <p>The server and the database are hosted by Render in Frankfurt, Germany. That is outside Rwanda. This is a known limit.</p>
        <p>Video calls run through Cloudflare with Daily or Google Meet as the fallback. Ask AI uses Google.</p>
      </Section>

      <Section id="choices" title="Your choices">
        <ul className="list-disc space-y-2 pl-6">
          <li>You can delete a matter or a document at any time.</li>
          <li>You can withdraw your consent to Ask AI by not using it.</li>
          <li>
            Students and staff can delete their whole account and everything attached to it in{' '}
            <Link to="/settings" className={LINK}>Account settings</Link> (Delete my account). This cannot be undone.
          </li>
          <li>Lawyers and admins ask an admin to delete their account, because their accounts are linked to published records.</li>
        </ul>
        <p>We keep your data until you delete it or your account.</p>
        <p>
          For anything else, use{' '}
          <Link to="/report" className={LINK}>Report a problem</Link>.
        </p>
      </Section>

      <Section id="law" title="The law behind this">
        <p>
          Rwanda&apos;s Law No. 058/2021 of 13/10/2021 on personal data and privacy applies.
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Article 6: consent.</li>
          <li>Article 8: withdrawing consent.</li>
          <li>Article 23: erasure.</li>
          <li>Article 50: personal data is stored in Rwanda unless it is authorised otherwise.</li>
          <li>Article 52: personal data is kept only until the purpose is fulfilled unless the law allows longer.</li>
        </ul>
        <p>We are not yet in line with Article 50 for hosting, because our server is in Frankfurt.</p>
      </Section>

      <Disclaimer className="mt-8" />
    </div>
  );
}
