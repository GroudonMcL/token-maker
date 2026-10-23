import { Link } from '../components/Link';
import { CREDITS, type CreditPart } from './credits';
import { PageLayout } from './PageLayout';

function Cell({ parts }: { parts: CreditPart[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.href ? (
          <a key={i} href={p.href} target="_blank" rel="noreferrer">
            {p.text}
          </a>
        ) : p.code ? (
          <code key={i}>{p.text}</code>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** About page, with every asset's credit from ASSETS-CREDITS.md (DESIGN.md §12). */
export function AboutPage() {
  return (
    <PageLayout title="About Token Maker">
      <p>
        Token Maker is a free tool for making tokens for D&amp;D and other tabletop roleplaying games. Import a picture,
        frame it, style it, and download it ready for Owlbear Rodeo, Foundry VTT, Roll20 or any other virtual tabletop.
      </p>
      <h2>How it works</h2>
      <ol>
        <li>
          <strong>Add a picture:</strong> upload it, drop it on the page, paste it, or paste a link to a picture, a web
          page or a Pinterest pin. No picture to hand? Press <em>Try a sample</em>.
        </li>
        <li>
          <strong>Style it:</strong> pick a frame and shape, light it, add effects, decorations and a name label, or start
          from a preset. Every <span aria-hidden="true">“?”</span> and every control’s name shows what it does, with a
          before-and-after picture.
        </li>
        <li>
          <strong>Download it:</strong> as PNG, WebP or JPG at the size your virtual tabletop needs, or copy it straight
          to the clipboard. Batch mode makes a whole set of tokens in one style.
        </li>
      </ol>
      <p>
        Everything happens in your browser, on your own device. There are no accounts and nothing to install. See{' '}
        <Link href="/privacy">Privacy</Link> for the details.
      </p>
      <h2>Credits</h2>
      <p>Every font, icon and picture that comes with Token Maker, where it is from and its licence.</p>
      <div className="credits">
        <table>
          <thead>
            <tr>
              <th scope="col">What</th>
              <th scope="col">From</th>
              <th scope="col">Licence</th>
            </tr>
          </thead>
          <tbody>
            {CREDITS.map((row, i) => (
              <tr key={i}>
                <td>
                  <Cell parts={row.asset} />
                </td>
                <td>
                  <Cell parts={row.source} />
                </td>
                <td>{row.licence.length === 1 && row.licence[0]!.text === '—' ? 'Made for Token Maker' : <Cell parts={row.licence} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="page__note">
        Fonts under the SIL Open Font License may be used, shared and changed freely, but not sold on their own.
      </p>
    </PageLayout>
  );
}
