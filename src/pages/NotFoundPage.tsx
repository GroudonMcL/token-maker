import { Link } from '../components/Link';
import { PageLayout } from './PageLayout';

export function NotFoundPage() {
  return (
    <PageLayout title="Page not found">
      <p>
        There's nothing at this address. <Link href="/">Go to the token editor</Link>.
      </p>
    </PageLayout>
  );
}
