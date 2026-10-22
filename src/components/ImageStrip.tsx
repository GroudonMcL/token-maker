import { useId, useState } from 'react';
import type { HelpId } from '../help/helpContent';
import { ControlLabel } from './ControlLabel';
import { useRovingRadio } from './useRovingRadio';

export interface StripImage {
  id: string;
  src: string;
  alt: string;
  /** Tried once if `src` fails to load (e.g. the same picture through the image proxy). */
  fallbackSrc?: string;
}

/**
 * A sideways-scrolling row of thumbnails to pick one from (e.g. images found
 * on a web page). With `minSide`, pictures that turn out smaller than that
 * (icons) are hidden once they load, as are pictures that fail to load.
 */
export function ImageStrip({
  label,
  helpId,
  images,
  value,
  onChange,
  emptyText = 'No images yet.',
  minSide,
  busyId,
}: {
  label: string;
  helpId: HelpId;
  images: readonly StripImage[];
  value: string | undefined;
  onChange: (id: string) => void;
  emptyText?: string;
  minSide?: number;
  /** The picture currently loading, shown with a spinner. */
  busyId?: string;
}) {
  const labelId = useId();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [fallen, setFallen] = useState<ReadonlySet<string>>(() => new Set());
  const visible = images.filter((i) => !hidden.has(i.id));
  const { onKeyDown, itemProps } = useRovingRadio(
    visible.map((i) => i.id),
    value,
    onChange,
  );
  const hide = (id: string) => setHidden((s) => new Set(s).add(id));
  return (
    <div className="image-strip" data-control="strip" data-help-id={helpId}>
      <ControlLabel id={labelId} label={label} helpId={helpId} />
      {visible.length === 0 ? (
        <p className="image-strip__empty">{emptyText}</p>
      ) : (
        <div className="image-strip__row" role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown}>
          {visible.map((img, i) => (
            <button
              key={img.id}
              type="button"
              className="image-strip__item"
              aria-busy={busyId === img.id || undefined}
              title={img.alt || undefined}
              {...itemProps(img.id, i)}
            >
              <img
                src={fallen.has(img.id) ? img.fallbackSrc : img.src}
                alt={img.alt}
                draggable={false}
                loading="lazy"
                referrerPolicy="no-referrer"
                onLoad={(e) => {
                  const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                  if (minSide && w && h && (w < minSide || h < minSide)) hide(img.id);
                }}
                onError={() => {
                  if (img.fallbackSrc && !fallen.has(img.id)) setFallen((s) => new Set(s).add(img.id));
                  else hide(img.id);
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
