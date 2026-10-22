import { useEffect, type ReactNode } from 'react';
import { useRoute } from './hooks/useRoute';
import { AppShell } from './layout/AppShell';
import { AboutPage } from './pages/AboutPage';
import { KitPage } from './pages/KitPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PrivacyPage } from './pages/PrivacyPage';

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
  return route ? route.page() : <NotFoundPage />;
}
