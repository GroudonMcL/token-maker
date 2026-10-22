// Layer 3 (DESIGN.md §6.3): the background behind the art, inside the
// frame's opening: a colour, a gradient or a picture (built-in, the user's
// own, or an enlarged copy of the art), with its own blur, move and zoom.
// Lighting can light it too, so the art and its background match (§6.5).

import type { BackgroundLayer, Gradient, LightingSettings, TokenDocument } from '../document/types';
import { blurImage } from '../image/filters';
import { newCanvas } from '../image/processedArt';
import { parseHex, rgba } from './color';
import { tracePolygon, type Ctx } from './frameKit';
import { baseScale } from './geometry';
import type { AssetMap, RenderSource } from './render';
import { boundingBox, type Point } from './shapes';

/** The asset id the background picture is kept under, if it has one. */
export function backgroundAssetId(doc: Pick<TokenDocument, 'background' | 'art'>): string | null {
  const img = doc.background.image;
  if (!img) return null;
  if (img.type === 'library') return `library:${img.id}`;
  if (img.type === 'asset') return img.assetId;
  return doc.art.assetId;
}

/**
 * A canvas gradient filling `box`. Linear runs across the box towards
 * `angle`; radial spreads from the middle to the corners.
 */
export function makeGradient(ctx: Ctx, g: Gradient, box: { minX: number; maxX: number; minY: number; maxY: number }): CanvasGradient {
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const hw = (box.maxX - box.minX) / 2;
  const hh = (box.maxY - box.minY) / 2;
  let grad: CanvasGradient;
  if (g.type === 'radial') {
    grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(hw, hh));
  } else {
    const a = (g.angle * Math.PI) / 180;
    const vx = Math.cos(a);
    const vy = Math.sin(a);
    const e = Math.abs(vx) * hw + Math.abs(vy) * hh;
    grad = ctx.createLinearGradient(cx - vx * e, cy - vy * e, cx + vx * e, cy + vy * e);
  }
  for (const s of g.stops) grad.addColorStop(Math.min(1, Math.max(0, s.offset)), rgba(s.color, s.opacity));
  return grad;
}

const blurred = new WeakMap<object, Map<number, RenderSource>>();
/** Blurring works on a copy at most this many pixels across: plenty for something blurred. */
const BLUR_SIDE = 640;

/** The picture blurred by `blur` (0–100 = up to 5 % of its longer side), cached. Same width and height as the original. */
export function blurredSource(src: RenderSource, blur: number): RenderSource {
  if (blur <= 0) return src;
  let byAmount = blurred.get(src.image as object);
  if (!byAmount) blurred.set(src.image as object, (byAmount = new Map()));
  const key = Math.round(blur * 10) / 10;
  const hit = byAmount.get(key);
  if (hit) return hit;
  const k = Math.min(1, BLUR_SIDE / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * k));
  const h = Math.max(1, Math.round(src.height * k));
  const c = newCanvas(w, h);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.drawImage(src.image, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const buf = { data: img.data, width: w, height: h };
  blurImage(buf, (key / 100) * 0.05 * Math.max(w, h));
  ctx.putImageData(img, 0, 0);
  const out = { image: c as CanvasImageSource, width: src.width, height: src.height };
  if (byAmount.size > 6) byAmount.clear();
  byAmount.set(key, out);
  return out;
}

/** Paints the background into the clip polygon (`clip` in pixels from the token centre; `R` the token's half-size). */
export function drawBackground(ctx: Ctx, doc: TokenDocument, assets: AssetMap, clip: Point[], R: number): void {
  const bg = doc.background;
  if (bg.kind === 'none' || bg.opacity <= 0 || !clip.length) return;
  const box = boundingBox(clip);
  ctx.save();
  tracePolygon(ctx, clip);
  ctx.clip();
  ctx.globalAlpha = Math.min(1, bg.opacity);
  let drew = true;
  if (bg.kind === 'color') {
    ctx.fillStyle = bg.color;
    ctx.fillRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
  } else if (bg.kind === 'gradient') {
    ctx.fillStyle = makeGradient(ctx, bg.gradient, box);
    ctx.fillRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
  } else {
    drew = drawPicture(ctx, bg, doc, assets, clip, R);
  }
  ctx.globalAlpha = 1;
  if (drew) lightBackground(ctx, doc.lighting, box);
  ctx.restore();
}

function drawPicture(ctx: Ctx, bg: BackgroundLayer, doc: TokenDocument, assets: AssetMap, clip: Point[], R: number): boolean {
  const id = backgroundAssetId(doc);
  const src = id ? assets.get(id) : undefined;
  if (!src) return false;
  const shown = blurredSource(src, bg.blur);
  const unitClip = clip.map((p) => ({ x: p.x / R, y: p.y / R }));
  const s = baseScale(src.width, src.height, unitClip) * bg.zoom * R;
  ctx.save();
  ctx.translate(bg.offsetX * R, bg.offsetY * R);
  ctx.scale(s, s);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(shown.image, -src.width / 2, -src.height / 2, src.width, src.height);
  ctx.restore();
  return true;
}

/**
 * The directional light on the background: darker away from the light and
 * tinted and brightened towards it, like the art (src/image/lighting.ts).
 */
function lightBackground(ctx: Ctx, l: LightingSettings, box: { minX: number; maxX: number; minY: number; maxY: number }): void {
  if (!l.enabled || !l.background || l.strength <= 0) return;
  const s = l.strength / 100;
  const f = l.falloff / 100;
  const w = box.maxX - box.minX;
  const h = box.maxY - box.minY;
  // A gradient running from the far side (0) to the side the light comes from (1).
  const towardsLight: Gradient = { type: 'linear', angle: l.direction, stops: [] };
  const fill = (stops: Gradient['stops'], op: GlobalCompositeOperation) => {
    ctx.globalCompositeOperation = op;
    ctx.fillStyle = makeGradient(ctx, { ...towardsLight, stops }, box);
    ctx.fillRect(box.minX, box.minY, w, h);
  };
  const { r, g, b } = parseHex(l.color);
  const top = Math.max(r, g, b, 1);
  const hue = `rgb(${Math.round((r / top) * 255)}, ${Math.round((g / top) * 255)}, ${Math.round((b / top) * 255)})`;
  // Tint everything a little towards the light's colour.
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.45 * s;
  ctx.fillStyle = hue;
  ctx.fillRect(box.minX, box.minY, w, h);
  ctx.globalAlpha = 1;
  fill(
    [
      { offset: 0, color: '#000000', opacity: Math.min(0.9, f * s * 0.85) },
      { offset: 0.6, color: '#000000', opacity: 0 },
    ],
    'source-over',
  );
  fill(
    [
      { offset: 0.5, color: l.color, opacity: 0 },
      { offset: 1, color: l.color, opacity: 0.35 * s },
    ],
    'screen',
  );
  ctx.globalCompositeOperation = 'source-over';
}
