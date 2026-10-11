import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div>
      <h1 className="font-head text-2xl text-primary">Page not found</h1>
      <p className="mt-2 text-muted-foreground">
        That page does not exist or has moved.{' '}
        <Link to="/" className="inline-flex min-h-touch items-center text-primary underline focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2">
          Go to the home page
        </Link>
      </p>
    </div>
  );
}
