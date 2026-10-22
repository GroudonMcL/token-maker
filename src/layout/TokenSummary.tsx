/** Thumbnail, name, size and final pixel size of the current token. Static until the document store exists. */
export function TokenSummary() {
  return (
    <div className="token-summary">
      <span className="token-summary__thumb" aria-hidden="true" />
      <span className="token-summary__text">
        <span className="token-summary__name">Untitled token</span>
        <span className="token-summary__meta">
          Medium · 1 square · <span className="num">256 × 256 px</span>
        </span>
      </span>
    </div>
  );
}
