import { PageLayout } from './PageLayout';

/** Placeholder About page. Asset credits (ASSETS-CREDITS.md) will be listed here (DESIGN.md §12). */
export function AboutPage() {
  return (
    <PageLayout title="About Token Maker">
      <p>
        Token Maker is a free tool for making tokens for D&amp;D and other tabletop roleplaying games. Import a picture,
        frame it, style it, and download it ready for Owlbear Rodeo, Foundry VTT, Roll20 or any other virtual tabletop.
      </p>
      <p>Everything happens in your browser, on your own device. There are no accounts.</p>
      <h2>Credits</h2>
      <p>
        Fonts: Grenze and Atkinson Hyperlegible, both under the SIL Open Font License. Icons: Lucide (ISC licence).
        Credits for built-in frames, backgrounds and decorations will be listed here as they are added.
      </p>
      <p className="page__note">This page is a placeholder and will be expanded before launch.</p>
    </PageLayout>
  );
}
