import { Link } from 'react-router-dom';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/lib/AuthContext';
import { canOwnActivity } from '@/lib/auth';
import GuideCard from '@/components/GuideCard';
import ErrorNotice from '@/components/ErrorNotice';
import { BUTTON_PRIMARY } from '@/lib/ui';

export default function SavedGuides() {
  const { user } = useAuth();

  // There are three cases. A visitor. A signed-in role that keeps no saved list. A student or
  // staff member. Only the last one asks the server. The list needs a login and the server refuses an
  // expert or an admin. Asking anyway would show them an error where nothing is wrong.
  const canSave = canOwnActivity(user);
  const { data: guides, error, loading } = useApi(canSave ? '/bookmarks' : null);

  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Saved guides</h1>

      {!user ? (
        <div className="mt-6 rounded border border-border bg-surface p-4">
          <p className="font-medium">Sign in to see your saved guides.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Saving a guide keeps it with your account. Reading the guides never needs one.
          </p>
          <Link to="/login" className={`${BUTTON_PRIMARY} mt-3`}>Sign in</Link>
        </div>
      ) : !canSave ? (
        // Not an error box. Nothing failed. This account type just keeps no saved list.
        <div className="mt-6 rounded border border-border bg-surface p-4">
          <p className="font-medium">Saved guides are for student and staff accounts.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You are signed in as {user.name}. Nothing is missing and nothing has gone wrong. Every
            guide is open to you without saving it.
          </p>
          <Link to="/guides" className={`${BUTTON_PRIMARY} mt-3`}>Browse the guides</Link>
        </div>
      ) : (
        <>
          {/* A guide leaves this list while it is being re-checked after an edit and comes back
              by itself. Without this sentence that looks like a lost save and the reader saves
              it again. */}
          <p className="mt-1 text-muted-foreground">
            The guides you kept, newest first. A guide drops off this list while it is being
            re-checked after an edit. It comes back on its own once a legal expert has verified
            it again. The save itself is never lost.
          </p>

          {loading && <p className="mt-6 text-muted-foreground">Loading your saved guides…</p>}
          {error && <ErrorNotice error={error} className="mt-6" />}

          {guides?.length === 0 && (
            <div className="mt-6 rounded border border-border bg-surface p-4">
              <p className="font-medium">You have not saved any guides yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open a guide and choose “Save this guide” to keep it here for later.
              </p>
              <Link to="/guides" className={`${BUTTON_PRIMARY} mt-3`}>Browse the guides</Link>
            </div>
          )}

          {/* The server already sends the newest save first. The page keeps that order. */}
          <ul className="mt-4 space-y-3">
            {guides?.map((g) => <GuideCard key={g.id} guide={g} />)}
          </ul>
        </>
      )}
    </div>
  );
}
