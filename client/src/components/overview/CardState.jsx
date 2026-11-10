import ErrorNotice from '@/components/ErrorNotice';

// What a card shows instead of its content: a loading line or the message of the server when a request failed
// or the words for an empty card.
// The empty words say what to do next so an empty card is never a dead end. Otherwise the children are shown.
export default function CardState({ loading, error, empty, children }) {
  if (error) return <ErrorNotice error={error} />;
  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (empty) return <div className="text-muted-foreground">{empty}</div>;
  return children;
}
