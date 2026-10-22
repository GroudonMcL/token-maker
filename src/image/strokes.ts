// Erase/restore brush strokes on the art's mask (DESIGN.md §6.2). Strokes are
// stored in the image's own coordinates (0–1), so they are drawn again at
// whatever resolution is needed: a quick preview while dragging, or full size
// for the export. Each stroke is drawn into its own buffer first (keeping the
// strongest coverage), so overlapping brush dabs don't build up darker.

import type { MaskStroke, PopOutStroke } from '../document/types';

/** An erase/restore stroke or a pop-out stroke: "erase" takes away, anything else adds. */
export type AnyStroke = MaskStroke | PopOutStroke;

/** Brush radius at a given pen pressure: light pressure still leaves a thin line. */
export const pressureRadius = (radius: number, pressure: number) => radius * (0.25 + 0.75 * Math.min(1, Math.max(0, pressure)));

/** Applies strokes to a 0–255 keep-mask in place. */
export function applyStrokes(mask: Uint8Array, w: number, h: number, strokes: readonly AnyStroke[]): void {
  for (const s of strokes) applyStroke(mask, w, h, s);
}

export function applyStroke(mask: Uint8Array, w: number, h: number, s: AnyStroke): void {
  const n = Math.floor(s.points.length / 3);
  if (!n || !w || !h) return;
  const radius = Math.max(0.75, (s.size * Math.max(w, h)) / 2);
  const pts: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    pts.push({ x: s.points[i * 3]! * w, y: s.points[i * 3 + 1]! * h, r: Math.max(0.75, pressureRadius(radius, s.points[i * 3 + 2]!)) });
  }

  // Area the stroke touches.
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x - p.r);
    y0 = Math.min(y0, p.y - p.r);
    x1 = Math.max(x1, p.x + p.r);
    y1 = Math.max(y1, p.y + p.r);
  }
  const bx = Math.max(0, Math.floor(x0));
  const by = Math.max(0, Math.floor(y0));
  const bw = Math.min(w, Math.ceil(x1) + 1) - bx;
  const bh = Math.min(h, Math.ceil(y1) + 1) - by;
  if (bw <= 0 || bh <= 0) return;
  const cover = new Float32Array(bw * bh);
  const hard = 1 - Math.min(1, Math.max(0, s.softness));

  const dab = (cx: number, cy: number, r: number) => {
    const inner = r * hard;
    const xa = Math.max(bx, Math.floor(cx - r));
    const xb = Math.min(bx + bw - 1, Math.ceil(cx + r));
    const ya = Math.max(by, Math.floor(cy - r));
    const yb = Math.min(by + bh - 1, Math.ceil(cy + r));
    for (let y = ya; y <= yb; y++) {
      const dy = y + 0.5 - cy;
      for (let x = xa; x <= xb; x++) {
        const dx = x + 0.5 - cx;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= r) continue;
        let a = 1;
        if (d > inner) {
          const t = (r - d) / (r - inner); // 0 at the rim → 1 inside
          a = t * t * (3 - 2 * t);
        }
        const k = (y - by) * bw + (x - bx);
        if (a > cover[k]!) cover[k] = a;
      }
    }
  };

  dab(pts[0]!.x, pts[0]!.y, pts[0]!.r);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const spacing = Math.max(0.5, Math.min(a.r, b.r) * 0.2);
    const steps = Math.max(1, Math.ceil(len / spacing));
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      dab(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.r + (b.r - a.r) * t);
    }
  }

  const erase = s.mode === 'erase';
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const c = cover[y * bw + x]!;
      if (c <= 0) continue;
      const p = (y + by) * w + (x + bx);
      const m = mask[p]!;
      mask[p] = Math.round(erase ? m * (1 - c) : m + (255 - m) * c);
    }
  }
}
