// Directional lighting and rim light on the art (DESIGN.md §6.5). Lighting
// is the last step of the processed art, so pop-out parts (Phase 5) are lit
// exactly like the rest. It works in the picture's own coordinates: the
// light direction on the token is turned into the picture's direction, so a
// rotated or flipped picture is still lit from the right side.

import type { ArtTransform, LightingSettings } from '../document/types';
import { parseHex } from '../render/color';
import type { PixelBuffer } from './adjust';

/** The light as the art's pixels see it. */
export interface ArtLight {
  /** Degrees, in the picture's own coordinates, that the light comes from (0 = right, 90 = below). */
  angle: number;
  color: string;
  /** 0…100 */
  strength: number;
  /** 0…100 */
  falloff: number;
  rim: { enabled: boolean; strength: number; width: number; softness: number };
}

const round = (v: number) => Math.round(v * 100) / 100;

/**
 * The light direction on the token → the same direction in the picture's
 * coordinates. The renderer turns picture points to the token by flipping,
 * then rotating, so this undoes the rotation, then the flips.
 */
export function imageAngle(tokenAngle: number, t: Pick<ArtTransform, 'rotation' | 'flipX' | 'flipY'>): number {
  let a = tokenAngle - t.rotation;
  if (t.flipX) a = 180 - a;
  if (t.flipY) a = -a;
  return round((((a % 360) + 360) % 360));
}

/** The light for the art, or null when lighting is off or would do nothing. */
export function artLight(l: LightingSettings, t: Pick<ArtTransform, 'rotation' | 'flipX' | 'flipY'>): ArtLight | null {
  if (!l.enabled || (l.strength <= 0 && !(l.rim.enabled && l.rim.strength > 0))) return null;
  return {
    angle: imageAngle(l.direction, t),
    color: l.color,
    strength: l.strength,
    falloff: l.falloff,
    rim: { ...l.rim },
  };
}

/** Lights `buf` in place. Transparent pixels stay transparent. */
export function applyLighting(buf: PixelBuffer, light: ArtLight): void {
  const { data: d, width: w, height: h } = buf;
  if (!w || !h) return;
  const rad = (light.angle * Math.PI) / 180;
  const lx = Math.cos(rad);
  const ly = Math.sin(rad);
  const { r, g, b } = parseHex(light.color);
  const top = Math.max(r, g, b, 1);
  // The light's colour with its brightest channel at 1, so a dark colour still tints rather than darkens.
  const hue = [r / top, g / top, b / top];
  const col = [r, g, b];
  const s = light.strength / 100;
  const f = light.falloff / 100;
  // How far the picture reaches along the light's direction, so t runs −1 (far side) … 1 (nearest the light).
  const reach = Math.max(1e-6, (Math.abs(lx) * w + Math.abs(ly) * h) / 2);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;

  const rimOn = light.rim.enabled && light.rim.strength > 0;
  const soft = Math.min(1, Math.max(0, (light.rim.softness ?? 0) / 100));
  // A soft rim reaches a little further, so softening fades it rather than only thinning it.
  const rimPx = Math.max(1, (light.rim.width / 100) * 0.025 * Math.max(w, h) * (1 + 0.6 * soft));
  const rimK = (light.rim.strength / 100) * 0.9;
  // Where to look for the see-through edge, and how much a hit that far away counts:
  // crisp rims count every hit fully; soft ones fade with the distance from the edge.
  const rimSteps = soft > 0 ? Math.max(3, Math.min(8, Math.round(rimPx / 2))) : 3;
  const rimSamples = Array.from({ length: rimSteps }, (_, j) => {
    const k = (j + 1) / rimSteps;
    const fade = k * k * (3 - 2 * k);
    return { at: rimPx * k, weight: 1 - soft * fade * 0.95 };
  });
  // Alpha never changes here, so reading it from the buffer being lit is safe.
  const alphaAt = (x: number, y: number) => {
    const xi = Math.min(w - 1, Math.max(0, Math.round(x)));
    const yi = Math.min(h - 1, Math.max(0, Math.round(y)));
    return d[(yi * w + xi) * 4 + 3]!;
  };

  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      const a = d[i + 3]!;
      if (a === 0) continue;
      const t = ((x - cx) * lx + (y - cy) * ly) / reach;
      const u = Math.min(1, Math.max(0, (t + 1) / 2));
      const shade = 1 - f * s * 0.95 * (1 - u) ** 1.1;
      const lift = 1 + 0.6 * s * u * u;
      const glow = 0.22 * s * u * u * u;
      let rim = 0;
      if (rimOn) {
        // A pixel whose neighbour towards the light is see-through is on the lit edge.
        let gap = 0;
        for (const k of rimSamples) gap = Math.max(gap, (1 - alphaAt(x + lx * k.at, y + ly * k.at) / 255) * k.weight);
        rim = rimK * gap;
      }
      for (let c = 0; c < 3; c++) {
        const tint = 1 - 0.6 * s + 0.6 * s * hue[c]!;
        d[i + c] = d[i + c]! * tint * shade * lift + col[c]! * (glow + rim);
      }
    }
  }
}
