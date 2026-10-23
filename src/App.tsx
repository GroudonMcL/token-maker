import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { useRoute } from './hooks/useRoute';
import { AppShell } from './layout/AppShell';

// The reading pages load only when visited (Phase 10).
const AboutPage = lazy(() => import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const KitPage = lazy(() => import('./pages/KitPage').then((m) => ({ default: m.KitPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const routes: Record<string, { title: string; page: () => ReactNode }> = {
  '/': { title: 'Token Maker', page: () => <AppShell /> },
  '/about': { title: 'About · Token Maker', page: () => <AboutPage /> },
  '/privacy': { title: 'Privacy · Token Maker', page: () => <PrivacyPage /> },
  '/kit': { title: 'UI kit · Token Maker', page: () => <KitPage /> },
};

export function App() {
  const path = useRoute().replace(/\/+$/, '') || '/';
  const route = routes[path];
  useEffect(() => {
    document.title = route?.title ?? 'Page not found · Token Maker';
  }, [route]);
  return <Suspense fallback={null}>{route ? route.page() : <NotFoundPage />}</Suspense>;
}
