import { PageLayout } from './PageLayout';

/** Placeholder Privacy page (DESIGN.md §13). */
export function PrivacyPage() {
  return (
    <PageLayout title="Privacy">
      <p>
        Your images are processed in your browser, on your own device. They are not uploaded to our server or stored by
        us.
      </p>
      <p>
        When you paste a web address or a Pinterest link, our server fetches that page or image for you and passes it
        straight back to your browser. It does not keep a copy. Small previews of the pictures found on a page load
        straight from that site, just as if you had visited it.
      </p>
      <p>
        Your work in progress, saved presets and uploaded fonts or frames are kept in your own browser storage so you
        don't lose them. Clearing your browser data removes them.
      </p>
      <p>Token Maker uses no analytics and no cookies.</p>
      <p className="page__note">This page is a placeholder and will be expanded before launch.</p>
    </PageLayout>
  );
}
