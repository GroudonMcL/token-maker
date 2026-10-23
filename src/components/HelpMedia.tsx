import type { HelpMedia as Media } from '../help/helpContent';
import { useMediaQuery } from '../hooks/useMediaQuery';

/**
 * The before/after picture or looping clip in a help card (DESIGN.md §11).
 * With reduced motion a clip doesn't play by itself: it shows its still
 * (the poster) with controls, so it plays only when asked.
 */
export function HelpMedia({ media }: { media: Media }) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  if (media.kind === 'image') return <img className="help-card__media" src={media.src} alt={media.alt} width={488} height={240} decoding="async" />;
  return (
    <video
      className="help-card__media"
      src={media.src}
      poster={media.poster}
      aria-label={media.alt}
      muted
      loop
      playsInline
      autoPlay={!reducedMotion}
      controls={reducedMotion}
    />
  );
}
