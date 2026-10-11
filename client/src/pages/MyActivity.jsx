import { Link } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity } from '@/lib/auth';
import ErrorNotice from '@/components/ErrorNotice';
import MeetLink from '@/components/MeetLink';
import { bookingStatusStep, readableSlot } from '@/lib/bookings';
import { readableDate } from '@/lib/dates';
import { RING, BUTTON_PRIMARY, BUTTON_OUTLINE } from '@/lib/ui';

const PANEL = 'rounded border border-border bg-surface p-4';

// The questions and bookings kept with a student or staff account. An anonymous question or
// booking stores no account, so it can never appear here. The page says so, because an empty
// list would otherwise look like a lost question.
export default function MyActivity() {
  const { user } = useAuth();

  // Only a student or staff member asks the server. The lists need a login and the server
  // refuses an expert or an admin. A visitor who asked would get a 401 and that clears a login
  // that may still be good.
  const canTrack = canOwnActivity(user);
  const { data: questions, error: questionsError, loading: questionsLoading } = useApi(canTrack ? '/questions/mine' : null);
  const { data: bookings, error: bookingsError, loading: bookingsLoading } = useApi(canTrack ? '/bookings/mine' : null);

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">My activity</h1>

      {!user ? (
        <div className={`mt-6 ${PANEL}`}>
          <p className="font-medium">Sign in to see what you have asked for.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This page lists the questions and appointments kept with your account. Asking
            anonymously never needs an account and never appears here.
          </p>
          <Link to="/login" className={`${BUTTON_PRIMARY} mt-3`}>Sign in</Link>
        </div>
      ) : !canTrack ? (
        <div className={`mt-6 ${PANEL}`}>
          <p className="font-medium">This page tracks student and staff accounts.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You are signed in as {user.name}. Questions and appointments are kept with the account
            that asked for them, so there is nothing here to show you. Nothing has gone wrong.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-1 text-muted-foreground">The questions and appointments kept with your account, newest first.</p>

          {/* This sentence matters most when a list is empty. Someone who asked anonymously
              and finds nothing here would think the question was lost. */}
          <div className={`mt-4 ${PANEL}`}>
            <p className="text-sm">
              Anything you sent anonymously is never listed here. It is stored with no account
              attached, and that is what keeps it anonymous. Use the one-time code you were given:{' '}
              <Link to="/ask/check" className={`font-semibold text-primary underline ${RING}`}>check an anonymous question</Link>
              {' '}or{' '}
              <Link to="/directory/booking-check" className={`font-semibold text-primary underline ${RING}`}>check an anonymous booking</Link>.
            </p>
          </div>

          <section aria-labelledby="questions-heading" className="mt-6">
            <h2 id="questions-heading" className="font-head text-lg font-semibold text-primary">Questions you sent to a legal expert</h2>
            {questionsLoading && <p className="mt-3 text-muted-foreground">Loading your questions…</p>}
            {/* One notice for each list, beside the list it belongs to. One shared notice could
                not say which half of the page is empty because it failed. */}
            {questionsError && <ErrorNotice error={questionsError} className="mt-3" />}
            {questions?.length === 0 && (
              <div className={`mt-3 ${PANEL}`}>
                <p className="font-medium">You have not asked a legal expert anything yet.</p>
                <Link to="/ask" className={`${BUTTON_PRIMARY} mt-3`}>Ask a lawyer</Link>
              </div>
            )}
            {/* The server already sends the newest first. The page keeps that order. */}
            <ul className="mt-3 space-y-3">
              {questions?.map((question) => {
                const sent = readableDate(question.created_at);
                return (
                  <li key={question.id} className={PANEL}>
                    <p className="text-xs font-medium text-muted-foreground">You asked</p>
                    <p className="mt-1 whitespace-pre-line">{question.text}</p>
                    {sent && <p className="mt-2 text-xs text-muted-foreground">Sent {sent}</p>}
                    {/* The answer decides, not the status word. */}
                    {question.answer ? (
                      <>
                        <p className="mt-3 text-xs font-medium text-muted-foreground">The reply</p>
                        <p className="mt-1 whitespace-pre-line">{question.answer}</p>
                        <p className="mt-2 text-xs italic text-muted-foreground">Legal information not legal advice.</p>
                      </>
                    ) : (
                      <>
                        <p className="mt-3 font-medium">No answer yet.</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          It reached the legal team and nobody has written back yet. You do not
                          need to send it again. The reply will show up on this page.
                        </p>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="bookings-heading" className="mt-8">
            <h2 id="bookings-heading" className="font-head text-lg font-semibold text-primary">Appointments you requested</h2>
            {bookingsLoading && <p className="mt-3 text-muted-foreground">Loading your appointments…</p>}
            {bookingsError && <ErrorNotice error={bookingsError} className="mt-3" />}
            {bookings?.length === 0 && (
              <div className={`mt-3 ${PANEL}`}>
                <p className="font-medium">You have not requested an appointment yet.</p>
                <Link to="/directory" className={`${BUTTON_PRIMARY} mt-3`}>Find a lawyer</Link>
              </div>
            )}
            <ul className="mt-3 space-y-3">
              {bookings?.map((booking) => {
                const step = bookingStatusStep(booking.status);
                return (
                  <li key={booking.id} className={PANEL}>
                    <h3 className="font-head font-semibold text-primary">{step.heading}</h3>
                    <p className="mt-1 text-sm">{step.body}</p>
                    <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                      <dt className="text-muted-foreground">With</dt>
                      <dd className="font-medium">{booking.provider_name}</dd>
                      <dt className="text-muted-foreground">Time</dt>
                      <dd className="font-medium">{readableSlot(booking.slot) ?? 'Not available'}</dd>
                      {booking.topic && (<><dt className="text-muted-foreground">About</dt><dd>{booking.topic}</dd></>)}
                    </dl>
                    <MeetLink booking={booking} className="mt-3" />
                    {step.next && <Link to="/directory" className={`${BUTTON_OUTLINE} mt-3`}>{step.next}</Link>}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
