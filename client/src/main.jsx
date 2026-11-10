import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from '@/lib/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { blockAriaDisabledClicks } from '@/lib/ariaDisabled';

blockAriaDisabledClicks();

// No useTransitions option: the router's default wraps navigation in React.startTransition, so the
// old page stays on screen while the next page file downloads. The shell shows a thin bar meanwhile
// (Layout, PageProgress). Setting useTransitions={false} would replace the old page with a Loading area.
// ErrorBoundary is outside everything else. A thrown error in any component then shows a
// message and not a blank page.
createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>
  </ErrorBoundary>,
);
