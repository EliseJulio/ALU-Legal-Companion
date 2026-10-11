import Disclaimer from '@/components/Disclaimer';

// The disclaimer is in the footer so it is on every page.
export default function Footer() {
  return (
    <footer className="mt-10 border-t border-border bg-surface">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Disclaimer />
        <p className="mt-2 text-xs text-muted-foreground">
          A capstone project for the African Leadership University community in Kigali.
        </p>
      </div>
    </footer>
  );
}
