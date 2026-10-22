// The one renderer (DESIGN.md §5). The live preview and every export come
// from renderToken with the same document; only the pixel size differs.
// It is a pure function of (document, assets, size): it reads nothing else.

import { computeInsets, perSquareToPx } from '../document/sizing';
import type { OuterShadow, TokenDocument } from '../document/types';
import { parseHex, rgba } from './color';
import { tracePolygon, type Ctx } from './frameKit';
import { drawFrame } from './frames';
import { newCanvas, processArt } from '../image/processArt';
import { baseScale } from './geometry';
import { shapePolygon } from './shapes';

/** A decoded image the renderer can draw. */
export interface RenderSource {
  image: CanvasImageSource;
  width: number;
  height: number;
}

/** Images referenced by the document, by asset id. */
export type AssetMap = ReadonlyMap<string, RenderSource>;

/** Editor-only extras. Exports never pass these, so they always get the finished token. */
export interface RenderOptions {
  /** Process the art at no more than this many pixels across (smooth previews while dragging). */
  artMaxSide?: number;
  /** Draw the frame see-through (0–1), e.g. 0.5 while brushing so the art under it shows. */
  frameAlpha?: number;
  /** Draw the unprocessed art faintly underneath (0–1), so brushed-away parts can still be seen. */
  ghostArt?: number;
}

/** Paints `doc` into a `size`×`size` area starting at the context's origin. */
export function renderToken(ctx: Ctx, doc: TokenDocument, assets: AssetMap, size: number, opts: RenderOptions = {}): void {
  const R = size / 2;
  const sq = doc.size.squares;
  const px = (perSquare: number) => perSquareToPx(perSquare, sq, size);
  const insets = computeInsets(doc);
  const hasFrame = doc.frame.style !== 'none' && insets.frameInner > insets.frameOuter;
  const art = doc.art.assetId ? assets.get(doc.art.assetId) : undefined;
  const clip = shapePolygon(doc.shape, R, insets.image * R);
  // The token's outline: the frame's outer edge, or the art's edge without a frame.
  const silhouette = shapePolygon(doc.shape, R, (hasFrame ? insets.frameOuter : insets.image) * R);

  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.translate(R, R);

  // 1. Outer drop shadow of the whole silhouette.
  if (doc.shadows.outer.enabled && silhouette.length) {
    outerShadow(ctx, silhouette, doc.shadows.outer, doc.lighting.direction, px, size);
  }

  // 2. Backing: shows through inner spacing, transparent art and letterboxed fits.
  const backing = shapePolygon(doc.shape, R, insets.backing * R);
  if (doc.frame.backingOpacity > 0 && backing.length) {
    const { r, g, b } = parseHex(doc.frame.backingColor);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1, doc.frame.backingOpacity)})`;
    tracePolygon(ctx, backing);
    ctx.fill();
  }

  // 3. Background layer — Phase 4.
  // 4. Effects behind the art — Phase 6.

  // 5. Processed art, clipped to the inner shape: adjustments, background
  // removal and brush strokes (src/image/processArt.ts); lighting joins in Phase 4.
  if (art && clip.length) {
    const processed = processArt(art, doc.art, opts.artMaxSide);
    ctx.save();
    tracePolygon(ctx, clip);
    ctx.clip();
    const t = doc.art.transform;
    const unitClip = clip.map((p) => ({ x: p.x / R, y: p.y / R }));
    const s = baseScale(art.width, art.height, unitClip) * t.zoom * R;
    ctx.translate(t.offsetX * R, t.offsetY * R);
    ctx.rotate((t.rotation * Math.PI) / 180);
    ctx.scale(t.flipX ? -s : s, t.flipY ? -s : s);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (opts.ghostArt && processed !== art) {
      ctx.globalAlpha = opts.ghostArt;
      ctx.drawImage(art.image, -art.width / 2, -art.height / 2, art.width, art.height);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(processed.image, -art.width / 2, -art.height / 2, art.width, art.height);
    ctx.restore();
  }

  // 6. Foreground overlays — Phase 4.
  // 7. Effects over the art — Phase 6.

  // 8–9 go on their own layer when the frame is to be see-through, so its
  // overlapping strokes fade evenly (editor only, never in exports).
  const fadeFrame = opts.frameAlpha !== undefined && opts.frameAlpha < 1 && hasFrame;
  const layer = fadeFrame ? createCanvas(size) : null;
  const fctx = layer ? (layer.getContext('2d') as Ctx) : ctx;
  if (layer) fctx.translate(R, R);

  // 8. Inner shadow: the frame's shadow onto the art.
  const inner = doc.shadows.inner;
  if (hasFrame && inner.enabled && inner.strength > 0 && clip.length) {
    const band = (insets.frameInner - insets.frameOuter) * R;
    const fall = shadowVector(doc.shadows.outer, doc.lighting.direction);
    fctx.save();
    tracePolygon(fctx, clip);
    fctx.clip();
    fctx.shadowColor = `rgba(0, 0, 0, ${inner.strength})`;
    fctx.shadowBlur = px(inner.softness);
    fctx.shadowOffsetX = fall.x * px(0.024);
    fctx.shadowOffsetY = fall.y * px(0.024);
    // A thick ring just outside the clip whose shadow falls inwards.
    const ring = Math.max(band, px(0.1));
    tracePolygon(fctx, shapePolygon(doc.shape, R, Math.max(0, insets.image * R - ring / 2)));
    fctx.lineWidth = ring;
    fctx.strokeStyle = '#000';
    fctx.stroke();
    fctx.restore();
  }

  // 9. Frame.
  if (hasFrame) {
    fctx.save();
    drawFrame(fctx, doc.frame.style, {
      shape: doc.shape,
      R,
      outer: insets.frameOuter * R,
      inner: insets.frameInner * R,
      color: doc.frame.color,
      accent: doc.frame.highlightColor ?? undefined,
    });
    fctx.restore();
  }

  if (layer) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, opts.frameAlpha!);
    ctx.drawImage(layer as CanvasImageSource, -R, -R);
    ctx.restore();
  }

  // 10. Effects on the border — Phase 6.
  // 11. Decorations — Phase 7.
  // 12. Pop-out shadow and 13. pop-out art — Phase 5 (reuse the art from step 5).
  // 14. Label — Phase 8.

  ctx.restore();
}

/** Unit vector of the direction a shadow falls. */
function shadowVector(shadow: OuterShadow, lightFrom: number): { x: number; y: number } {
  // Light from the top left (225°) casts shadows down and to the right.
  const deg = shadow.followLight ? lightFrom - 180 : shadow.angle;
  const a = (deg * Math.PI) / 180;
  return { x: Math.cos(a), y: Math.sin(a) };
}

/**
 * Draws only the shadow of the silhouette, then clears the area under the
 * silhouette so the shadow never shows through transparent parts of the token.
 */
function outerShadow(
  ctx: Ctx,
  silhouette: { x: number; y: number }[],
  shadow: OuterShadow,
  lightFrom: number,
  px: (v: number) => number,
  size: number,
): void {
  const fall = shadowVector(shadow, lightFrom);
  const far = size * 4; // draw the shape off-canvas; only its shadow lands on it
  ctx.save();
  ctx.shadowColor = rgba(shadow.color, shadow.opacity);
  ctx.shadowBlur = px(shadow.blur);
  ctx.shadowOffsetX = fall.x * px(shadow.distance) + far;
  ctx.shadowOffsetY = fall.y * px(shadow.distance);
  ctx.translate(-far, 0);
  tracePolygon(ctx, silhouette);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  tracePolygon(ctx, silhouette);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
}

/** Creates a canvas in the browser (main thread or worker), or a test's canvas. */
export function createCanvas(size: number): HTMLCanvasElement | OffscreenCanvas {
  return newCanvas(size, size);
}

/** render(doc, assets, outputSize) → canvas (DESIGN.md §4.1). */
export function render(doc: TokenDocument, assets: AssetMap, outputSize: number): HTMLCanvasElement | OffscreenCanvas {
  const canvas = createCanvas(outputSize);
  const ctx = canvas.getContext('2d') as Ctx;
  renderToken(ctx, doc, assets, outputSize);
  return canvas;
}
