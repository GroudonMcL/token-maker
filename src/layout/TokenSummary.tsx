import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { SIZE_PRESETS } from '../document/defaults';
import { outputSize, squaresLabel } from '../document/sizing';
import { renderToken } from '../render/render';
import { assetStore } from '../state/assets';
import { useDoc } from '../state/tokenStore';
import { useExportSettings } from '../export/exportSettings';

/** Thumbnail, name, size and final pixel size of the current token. */
export function TokenSummary() {
  const doc = useDoc();
  const assets = useStore(assetStore, (s) => s.assets);
  const thumb = useRef<HTMLCanvasElement>(null);
  const hasArt = doc.art.assetId !== null;

  useEffect(() => {
    if (!hasArt) return;
    // A small preview, redrawn shortly after changes settle.
    const id = setTimeout(() => {
      const c = thumb.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      const px = Math.round(36 * Math.min(2, window.devicePixelRatio || 1));
      c.width = px;
      c.height = px;
      renderToken(ctx, doc, assets, px);
    }, 150);
    return () => clearTimeout(id);
  }, [doc, assets, hasArt]);

  const pxPerSquare = useExportSettings((s) => s.pxPerSquare);
  const px = outputSize(doc.size.squares, pxPerSquare);
  const sizeName = SIZE_PRESETS.find((s) => s.id === doc.size.preset)?.name ?? 'Custom';
  return (
    <div className="token-summary">
      {hasArt ? (
        <canvas ref={thumb} className="token-summary__thumb token-summary__thumb--art" aria-hidden="true" />
      ) : (
        <span className="token-summary__thumb" aria-hidden="true" />
      )}
      <span className="token-summary__text">
        <span className="token-summary__name">{doc.name}</span>
        <span className="token-summary__meta">
          {sizeName} · {squaresLabel(doc.size.squares)} ·{' '}
          <span className="num" data-testid="pixel-size">
            {px} × {px} px
          </span>
        </span>
      </span>
    </div>
  );
}
