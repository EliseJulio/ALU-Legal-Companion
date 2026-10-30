import { Link, useLocation } from 'react-router-dom';
import { signInPath } from '@/lib/url';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity } from '@/lib/auth';
import { useMediaQuery } from '@/lib/useMediaQuery';
import Breadcrumb from '@/components/Breadcrumb';
import Callout from '@/components/Callout';
import ErrorNotice from '@/components/ErrorNotice';
import MeetLink from '@/components/MeetLink';
import StatusPill from '@/components/StatusPill';
import { bookingStatusStep, readableSlot } from '@/lib/bookings';
import { readableDate } from '@/lib/dates';
import { BUTTON_PRIMARY, BUTTON_OUTLINE, BUTTON_TEXT } from '@/lib/ui';

const PANEL = 'rounded-card border border-border bg-surface p-6';
const H2 = 'font-head text-2xl leading-heading text-primary';
const CELL = 'px-4 py-4 align-top text-sm';
const HEAD = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

// The answer decides the status, not the status word the server keeps.
const questionStatus = (question) => (question.answer ? 'answered' : 'awaiting_response');

function Answer({ question }) {
  return (
    <>
      <p className="mt-3 text-xs font-medium text-muted-foreground">The reply</p>
      <p className="mt-1 whitespace-pre-line">{question.answer}</p>
      <p className="mt-2 text-xs italic text-muted-foreground">Legal information not legal advice.</p>
    </>
  );
}

// Questions on a wide screen: one row each. The answer, or the plain fact that there is none yet,
// is in the Detail column so the reader never has to open anything.
function QuestionTable({ questions }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[48rem] text-left">
        <caption className="sr-only">Your questions with their status and the reply if there is one</caption>
        <thead className="border-b border-border bg-canvas">
          <tr>{['Record', 'Status', 'Detail', 'Sent'].map((n) => <th key={n} scope="col" className={HEAD}>{n}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {questions.map((q) => (
            <tr key={q.id}>
              <td className={`${CELL} w-[18rem]`}><p className="whitespace-pre-line font-semibold text-primary">{q.text}</p></td>
              <td className={CELL}><StatusPill status={questionStatus(q)} /></td>
              <td className={CELL}>
                {q.answer ? (
                  <>
                    <p className="whitespace-pre-line">{q.answer}</p>
                    <p className="mt-2 text-xs italic text-muted-foreground">Legal information not legal advice.</p>
                  </>
                ) : (
                  <p>Awaiting an expert response. It reached the legal team. You do not need to send it again.</p>
                )}
              </td>
              <td className={CELL}>{readableDate(q.created_at) ?? 'Not recorded'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuestionCards({ questions }) {
  return (
    <ul className="mt-3 space-y-3">
      {questions.map((question) => {
        const sent = readableDate(question.created_at);
        return (
          <li key={question.id} className={PANEL}>
            <StatusPill status={questionStatus(question)} />
            <p className="mt-2 text-xs font-medium text-muted-foreground">You asked</p>
            <p className="mt-1 whitespace-pre-line">{question.text}</p>
            {sent && <p className="mt-2 text-xs text-muted-foreground">Sent {sent}</p>}
            {question.answer ? <Answer question={question} /> : (
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
  );
}

// What a booking is doing, in words. Used by the table row.
function BookingDetail({ booking, step }) {
  return (
    <>
      <p className="font-semibold">{step.heading}</p>
      <p className="mt-1 text-sm">{step.body}</p>
      <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Time</dt>
        <dd className="font-medium">{readableSlot(booking.slot) ?? 'Not available'}</dd>
        {booking.topic && (<><dt className="text-muted-foreground">About</dt><dd>{booking.topic}</dd></>)}
      </dl>
    </>
  );
}

function BookingTable({ bookings }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[52rem] text-left">
        <caption className="sr-only">Your consultation requests with their status and what to do next</caption>
        <thead className="border-b border-border bg-canvas">
          <tr>{['Provider', 'Status', 'Booking detail', 'Action'].map((n) => <th key={n} scope="col" className={HEAD}>{n}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {bookings.map((booking) => {
            const step = bookingStatusStep(booking.status);
            return (
              <tr key={booking.id}>
                <th scope="row" className={`${CELL} w-[14rem] font-normal`}><p className="font-semibold text-primary">{booking.provider_name}</p></th>
                <td className={CELL}><StatusPill status={booking.status} /></td>
                <td className={CELL}><BookingDetail booking={booking} step={step} /></td>
                <td className={`${CELL} w-[20rem]`}>
                  <MeetLink booking={booking} />
                  {step.next && <Link to="/directory" className={`${BUTTON_OUTLINE} mt-3`}>{step.next}</Link>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BookingCards({ bookings }) {
  return (
    <ul className="mt-3 space-y-3">
      {bookings.map((booking) => {
        const step = bookingStatusStep(booking.status);
        return (
          <li key={booking.id} className={PANEL}>
            <StatusPill status={booking.status} />
            <h3 className="mt-2 font-head font-semibold text-primary">{step.heading}</h3>
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
  );
}

// The questions and bookings kept with a student or staff account. An anonymous question or
// booking stores no account, so it can never appear here. The page says so, because an empty
// list would otherwise look like a lost question.
export default function MyActivity() {
  const { user } = useAuth();
  const here = useLocation();

  // Only a student or staff member asks the server. The lists need a login and the server
  // refuses an expert or an admin. A visitor who asked would get a 401 and that clears a login
  // that may still be good.
  const canTrack = canOwnActivity(user);
  const { data: questions, error: questionsError, loading: questionsLoading } = useApi(canTrack ? '/questions/mine' : null);
  const { data: bookings, error: bookingsError, loading: bookingsLoading } = useApi(canTrack ? '/bookings/mine' : null);
  const wide = useMediaQuery('(min-width: 1280px)');

  return (
    <div>
      <Breadcrumb trail={[{ label: 'Home', to: '/' }]} current="My Activity" />
      <h1 className="mt-6 font-head text-4xl leading-heading text-primary md:text-5xl">My Activity</h1>

      {!user ? (
        <div className={`mt-6 ${PANEL}`}>
          <p className="font-medium">Sign in to see what you have asked for.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This page lists the questions and appointments kept with your account. Asking
            anonymously never needs an account and never appears here.
          </p>
          <Link to={signInPath(here)} className={`${BUTTON_PRIMARY} mt-3`}>Sign in</Link>
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
          <p className="mt-4 max-w-reading text-muted-foreground">
            Your linked questions, answers and consultation requests, newest first. Anonymous
            submissions are not listed here.
          </p>

          <section aria-labelledby="questions-heading" className="mt-8">
            <h2 id="questions-heading" className={H2}>Questions</h2>
            <p className="mt-1 text-sm text-muted-foreground">Questions you sent to a legal expert with this account.</p>
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
            {questions?.length > 0 && (wide ? <QuestionTable questions={questions} /> : <QuestionCards questions={questions} />)}
          </section>

          <section aria-labelledby="bookings-heading" className="mt-10">
            <h2 id="bookings-heading" className={H2}>Consultation requests</h2>
            <p className="mt-1 text-sm text-muted-foreground">Appointments you requested with this account.</p>
            {bookingsLoading && <p className="mt-3 text-muted-foreground">Loading your appointments…</p>}
            {bookingsError && <ErrorNotice error={bookingsError} className="mt-3" />}
            {bookings?.length === 0 && (
              <div className={`mt-3 ${PANEL}`}>
                <p className="font-medium">You have not requested an appointment yet.</p>
                <Link to="/directory" className={`${BUTTON_PRIMARY} mt-3`}>Find a lawyer</Link>
              </div>
            )}
            {bookings?.length > 0 && (wide ? <BookingTable bookings={bookings} /> : <BookingCards bookings={bookings} />)}
          </section>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <Callout title="This is your private account activity" className="self-start">
              Other members and administrators do not receive access to your question text here.
            </Callout>
            {/* This sentence matters most when a list is empty. Someone who asked anonymously
                and finds nothing here would think the question was lost. */}
            <section className={PANEL} aria-labelledby="anon-heading">
              <h2 id="anon-heading" className={H2}>Asked anonymously?</h2>
              <p className="mt-2 text-sm">
                Anything you sent anonymously is never listed here. It is stored with no account
                attached, and that is what keeps it anonymous. Use the one-time code you were given.
              </p>
              <div className="mt-2 flex flex-col">
                <Link to="/ask/check" className={BUTTON_TEXT}>Check an anonymous question →</Link>
                <Link to="/directory/booking-check" className={BUTTON_TEXT}>Check an anonymous booking →</Link>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
