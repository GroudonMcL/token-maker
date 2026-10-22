// The one renderer (DESIGN.md §5). The live preview and every export come
// from renderToken with the same document; only the pixel size differs.
// It is a pure function of (document, assets, size): it reads nothing else.

import { computeInsets, perSquareToPx } from '../document/sizing';
import type { OuterShadow, TokenDocument } from '../document/types';
import { parseHex, rgba } from './color';
import { tracePolygon, type Ctx } from './frameKit';
import { drawFrame } from './frames';
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

/** Paints `doc` into a `size`×`size` area starting at the context's origin. */
export function renderToken(ctx: Ctx, doc: TokenDocument, assets: AssetMap, size: number): void {
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

  // 5. Processed art, clipped to the inner shape. (Adjustments, background
  // removal and lighting join this step in Phases 3–4.)
  if (art && clip.length) {
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
    ctx.drawImage(art.image, -art.width / 2, -art.height / 2, art.width, art.height);
    ctx.restore();
  }

  // 6. Foreground overlays — Phase 4.
  // 7. Effects over the art — Phase 6.

  // 8. Inner shadow: the frame's shadow onto the art.
  const inner = doc.shadows.inner;
  if (hasFrame && inner.enabled && inner.strength > 0 && clip.length) {
    const band = (insets.frameInner - insets.frameOuter) * R;
    const fall = shadowVector(doc.shadows.outer, doc.lighting.direction);
    ctx.save();
    tracePolygon(ctx, clip);
    ctx.clip();
    ctx.shadowColor = `rgba(0, 0, 0, ${inner.strength})`;
    ctx.shadowBlur = px(inner.softness);
    ctx.shadowOffsetX = fall.x * px(0.024);
    ctx.shadowOffsetY = fall.y * px(0.024);
    // A thick ring just outside the clip whose shadow falls inwards.
    const ring = Math.max(band, px(0.1));
    tracePolygon(ctx, shapePolygon(doc.shape, R, Math.max(0, insets.image * R - ring / 2)));
    ctx.lineWidth = ring;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    ctx.restore();
  }

  // 9. Frame.
  if (hasFrame) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, doc.frame.opacity));
    drawFrame(ctx, doc.frame.style, {
      shape: doc.shape,
      R,
      outer: insets.frameOuter * R,
      inner: insets.frameInner * R,
      color: doc.frame.color,
    });
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

/** Creates a canvas in the browser (main thread or worker). */
export function createCanvas(size: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    return c;
  }
  return new OffscreenCanvas(size, size);
}

/** render(doc, assets, outputSize) → canvas (DESIGN.md §4.1). */
export function render(doc: TokenDocument, assets: AssetMap, outputSize: number): HTMLCanvasElement | OffscreenCanvas {
  const canvas = createCanvas(outputSize);
  const ctx = canvas.getContext('2d') as Ctx;
  renderToken(ctx, doc, assets, outputSize);
  return canvas;
}
