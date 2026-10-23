import { Link } from '../components/Link';

/** Site footer below the editor: About, Privacy (and the UI kit while developing). */
export function Footer() {
  return (
    <footer className="site-footer">
      <nav aria-label="Site">
        <Link href="/about">About</Link>
        <Link href="/privacy">Privacy</Link>
        {import.meta.env.DEV && <Link href="/kit">UI kit</Link>}
      </nav>
      <p>Your pictures are processed on your device and never uploaded.</p>
    </footer>
  );
}
