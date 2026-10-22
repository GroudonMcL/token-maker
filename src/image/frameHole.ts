// Finding the hole in a picture (PNG) frame (DESIGN.md §6.9): the
// see-through area joined to the middle of the picture. The hole becomes the
// art's clipping shape, stored as a polygon in token units, so the renderer
// never has to look at the frame's pixels.
//
// The picture is drawn to fill the token's square (fitted, keeping its
// shape), so token units here run from -1 to 1 across the picture's longer
// side. Plain pixel maths, so it runs the same in tests.

import type { PixelBuffer } from './adjust';

export interface FrameHole {
  /** The hole as a flat x, y list in token units (R = 1, from the centre), clockwise from the right. */
  hole: number[];
  /** How far the picture's solid parts reach from the centre, in token units. */
  outer: number;
  /** False when no see-through middle was found, so a stand-in circle is used. */
  found: boolean;
  /** True when the see-through middle runs out to the picture's edge (the frame isn't closed all round). */
  open: boolean;
}

/** Pixels at or above this alpha count as frame. */
const SOLID = 128;
/** Points round the hole. */
const RAYS = 120;
/** The art reaches this far under the frame's inner edge (token units), so the soft edge never shows a gap. */
const GROW = 0.012;
/** Used when there is no hole to find. */
const FALLBACK_RADIUS = 0.75;

const round = (v: number) => Math.round(v * 10000) / 10000;

/** A circle of radius `r` as a flat hole list. */
export function circleHole(r = FALLBACK_RADIUS, points = RAYS): number[] {
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    out.push(round(r * Math.cos(a)), round(r * Math.sin(a)));
  }
  return out;
}

/**
 * Looks at a frame picture's alpha and finds its hole. Pass a copy no bigger
 * than about 512 px for speed; the result doesn't depend on the size.
 */
export function findFrameHole(px: PixelBuffer): FrameHole {
  const { width: w, height: h, data } = px;
  const side = Math.max(w, h);
  // Token units per pixel, and the picture's top-left corner in token units (it is centred in the square).
  const unit = 2 / side;
  const left = -w / side;
  const top = -h / side;
  const solid = (x: number, y: number) => data[(y * w + x) * 4 + 3]! >= SOLID;

  // How far the solid parts reach from the centre.
  let outer = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      const ux = left + (x + 0.5) * unit;
      const uy = top + (y + 0.5) * unit;
      outer = Math.max(outer, ux * ux + uy * uy);
    }
  }
  outer = round(Math.min(1.5, Math.sqrt(outer)));

  const start = seed(w, h, solid);
  if (!start) return { hole: circleHole(), outer: outer || 1, found: false, open: false };

  // Flood-fill the see-through area joined to the start.
  const region = new Uint8Array(w * h);
  const stack = [start.y * w + start.x];
  region[stack[0]!] = 1;
  let open = false;
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    sumX += x;
    sumY += y;
    count++;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) open = true;
    const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of next) {
      if (j < 0 || region[j] || data[j * 4 + 3]! >= SOLID) continue;
      region[j] = 1;
      stack.push(j);
    }
  }

  // Rays out from the hole's middle (the picture's middle when the hole runs off the edge).
  const ox = open ? (w - 1) / 2 : sumX / count;
  const oy = open ? (h - 1) / 2 : sumY / count;
  const radii: number[] = [];
  for (let k = 0; k < RAYS; k++) {
    const a = (k / RAYS) * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    // Step over anything solid at the very middle (a gem over the hole), then
    // out to where the hole ends: the frame, or (for an open frame) anything solid.
    const inHole = (x: number, y: number) => (open ? !solid(x, y) : region[y * w + x] === 1);
    let d = 0;
    let entered = false;
    for (;;) {
      const x = Math.round(ox + dx * (d + 0.5));
      const y = Math.round(oy + dy * (d + 0.5));
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      if (inHole(x, y)) entered = true;
      else if (entered) break;
      d += 0.5;
    }
    radii.push(entered ? d : 0);
  }
  // A ray stopped short by a thin spike into the hole (a chain link, a thorn)
  // takes its neighbours' length instead; corners that reach further stay.
  const smooth = radii.map((r, k) => {
    const three = [radii[(k + RAYS - 1) % RAYS]!, r, radii[(k + 1) % RAYS]!].sort((p, q) => p - q);
    return Math.max(r, three[1]!);
  });

  const cx = left + (ox + 0.5) * unit;
  const cy = top + (oy + 0.5) * unit;
  const hole: number[] = [];
  smooth.forEach((d, k) => {
    const a = (k / RAYS) * Math.PI * 2;
    const r = d * unit + GROW;
    hole.push(round(Math.max(-1.5, Math.min(1.5, cx + r * Math.cos(a)))), round(Math.max(-1.5, Math.min(1.5, cy + r * Math.sin(a)))));
  });
  return { hole, outer: outer || 1, found: true, open };
}

/** The see-through pixel nearest the middle, searching outwards up to a fifth of the picture. */
function seed(w: number, h: number, solid: (x: number, y: number) => boolean): { x: number; y: number } | null {
  const mx = Math.floor(w / 2);
  const my = Math.floor(h / 2);
  const limit = Math.round(Math.min(w, h) * 0.2);
  for (let r = 0; r <= limit; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = mx + dx;
        const y = my + dy;
        if (x >= 0 && y >= 0 && x < w && y < h && !solid(x, y)) return { x, y };
      }
    }
  }
  return null;
}

/** The hole with the user's nudge applied: scaled around its middle, then moved. Token units. */
export function nudgedHole(hole: readonly number[], nudge: { x: number; y: number; scale: number }): { x: number; y: number }[] {
  const n = hole.length / 2;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += hole[i * 2]!;
    my += hole[i * 2 + 1]!;
  }
  mx /= n || 1;
  my /= n || 1;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: mx + (hole[i * 2]! - mx) * nudge.scale + nudge.x, y: my + (hole[i * 2 + 1]! - my) * nudge.scale + nudge.y });
  }
  return out;
}
