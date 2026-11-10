import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptionalUser } from '@/lib/AuthContext';
import { hasRole } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import { BUTTON_PRIMARY, CARD, FORM_FIELD } from '@/lib/ui';

const MAX_QUESTION = 500;

// A card at the top of Legal Guides. Its question is passed to the Ask AI page in the address. It is not sent from here.
// It shows only when Ask AI is set up. It is never shown to a legal expert.
export default function AskAiCard() {
  const user = useOptionalUser();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const { data: status, error, loading } = useApi('/ask-ai/status');

  if (hasRole(user, ['legal_expert'])) return null;
  if (loading || error || status?.available !== true) return null;

  function submit(event) {
    event.preventDefault();
    const question = text.trim();
    navigate(question ? `/ask-ai?q=${encodeURIComponent(question)}` : '/ask-ai');
  }

  return (
    <section aria-labelledby="ask-ai-card-heading" className={`mt-8 ${CARD}`}>
      <h2 id="ask-ai-card-heading" className="font-head text-[length:clamp(18px,2vw,22px)] leading-[1.2] text-ink">Ask AI</h2>
      <p className="mt-2 text-sm text-muted-foreground">Ask a question about the published guides.</p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="ask-ai-card-question" className="block text-sm font-semibold">Your question</label>
          <input
            id="ask-ai-card-question"
            type="text"
            value={text}
            maxLength={MAX_QUESTION}
            onChange={(e) => setText(e.target.value)}
            className={FORM_FIELD}
          />
        </div>
        <button type="submit" className={BUTTON_PRIMARY}>Ask</button>
      </form>
    </section>
  );
}
