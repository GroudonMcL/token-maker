import { useId } from 'react';
import type { HelpId } from '../help/helpContent';
import { ControlLabel } from './ControlLabel';
import { useRovingRadio } from './useRovingRadio';

export interface StripImage {
  id: string;
  src: string;
  alt: string;
}

/** A sideways-scrolling row of thumbnails to pick one from (e.g. images found on a web page). */
export function ImageStrip({
  label,
  helpId,
  images,
  value,
  onChange,
  emptyText = 'No images yet.',
}: {
  label: string;
  helpId: HelpId;
  images: readonly StripImage[];
  value: string | undefined;
  onChange: (id: string) => void;
  emptyText?: string;
}) {
  const labelId = useId();
  const { onKeyDown, itemProps } = useRovingRadio(
    images.map((i) => i.id),
    value,
    onChange,
  );
  return (
    <div className="image-strip" data-control="strip" data-help-id={helpId}>
      <ControlLabel id={labelId} label={label} helpId={helpId} />
      {images.length === 0 ? (
        <p className="image-strip__empty">{emptyText}</p>
      ) : (
        <div className="image-strip__row" role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown}>
          {images.map((img, i) => (
            <button key={img.id} type="button" className="image-strip__item" {...itemProps(img.id, i)}>
              <img src={img.src} alt={img.alt} draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
