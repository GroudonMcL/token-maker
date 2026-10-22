/** The placeholder logo: a gold token ring (final logo to be decided, DESIGN.md title). */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand-mark">
      <defs>
        <linearGradient id="bm-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent-hover)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="13" fill="var(--bg-top)" />
      <circle cx="16" cy="16" r="12" fill="none" stroke="url(#bm-ring)" strokeWidth="4" />
      <circle cx="16" cy="16" r="9.6" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="1" />
      <path d="M16 9.5l1.9 4.3 4.6.4-3.5 3 1.1 4.5-4.1-2.4-4.1 2.4 1.1-4.5-3.5-3 4.6-.4z" fill="var(--accent)" />
    </svg>
  );
}
