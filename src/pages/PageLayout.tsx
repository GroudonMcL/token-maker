import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from '../components/Link';
import { BrandMark } from '../layout/BrandMark';
import { Footer } from '../layout/Footer';

/** Simple reading layout for the About and Privacy pages. */
export function PageLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page">
      <header className="page__header">
        <Link href="/" className="topbar__brand">
          <BrandMark />
          <span className="topbar__name">Token Maker</span>
        </Link>
        <Link href="/" className="btn btn--ghost">
          <ArrowLeft size={18} aria-hidden="true" />
          Back to the editor
        </Link>
      </header>
      <main className="page__main">
        <h1>{title}</h1>
        {children}
      </main>
      <Footer />
    </div>
  );
}
