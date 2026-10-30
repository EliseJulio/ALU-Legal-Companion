import { Component } from 'react';

// The last line of defence. A thrown error anywhere in the page would otherwise leave a blank
// screen with no way back except a full reload. Components should still handle the errors they
// can act on such as a failed request. This catches the ones they missed.
// The message is plain on purpose. The page below is broken so it shows no menu and no branding.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // The full error goes to the console for the developer. The screen shows only the message.
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="max-w-md rounded border border-border bg-surface p-6 text-center">
            <h1 className="font-head text-xl text-primary">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              An unexpected error stopped the page from loading. Your data is safe.
              This is a display problem and not a loss of data.
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex min-h-button items-center justify-center rounded bg-primary px-5 font-sans font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            >
              Reload the page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
