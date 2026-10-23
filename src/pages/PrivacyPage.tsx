import { Link } from '../components/Link';
import { PageLayout } from './PageLayout';

/** Privacy page (DESIGN.md §13). */
export function PrivacyPage() {
  return (
    <PageLayout title="Privacy">
      <p>
        <strong>In short:</strong> your pictures stay on your device, there are no accounts, no analytics, no cookies
        and no adverts.
      </p>

      <h2>Your pictures</h2>
      <p>
        Pictures you upload, drop or paste are opened and edited in your browser, on your own device. They are never
        sent to our server, and the tokens you make are saved straight from your browser.
      </p>

      <h2>Web addresses and Pinterest links</h2>
      <p>
        When you paste a link, our small server (running on Cloudflare) fetches that web page or picture for you, because
        most sites don’t let one website read another’s pictures directly. It passes the picture or the list of pictures
        on the page straight back to your browser and keeps no copy. To stop misuse, it counts how many requests come
        from each internet address for one minute, in memory only, and refuses private or local addresses.
      </p>
      <p>
        The small previews of pictures found on a page load straight from that site, just as if you had visited it, so
        that site can see your request as usual.
      </p>

      <h2>What is kept in your browser</h2>
      <p>To save your work, these are kept in your own browser’s storage, on your device only:</p>
      <ul>
        <li>the token you are working on (and its pictures), so a refresh doesn’t lose it — <em>New</em> clears it;</li>
        <li>the presets you save, and the frames and fonts you upload;</li>
        <li>small settings such as the theme, brush size and export choices.</li>
      </ul>
      <p>They never leave your device. Clearing this site’s data in your browser removes them.</p>

      <h2>Hosting</h2>
      <p>
        The site is hosted on Cloudflare Pages. Like any web host, Cloudflare handles the requests your browser makes
        (for example your internet address) to deliver the site and protect it from attacks; see{' '}
        <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">
          Cloudflare’s privacy policy
        </a>
        . Token Maker itself adds no tracking.
      </p>

      <h2>Changes</h2>
      <p>
        If anything here changes — for example if adverts or optional accounts are ever added — this page will say so
        first, and anything that needs your permission will ask for it. See <Link href="/about">About</Link> for what
        Token Maker is.
      </p>
    </PageLayout>
  );
}
