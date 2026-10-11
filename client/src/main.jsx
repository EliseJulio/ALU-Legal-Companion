import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from '@/lib/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';

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
