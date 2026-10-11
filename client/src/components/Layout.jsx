import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* The first thing a keyboard user can reach. It jumps over the header. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:text-primary"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        {children}
      </main>
      <Footer />
    </div>
  );
}
