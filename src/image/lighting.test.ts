// @vitest-environment node
import { DEFAULT_LIGHTING, LIGHT_PRESETS } from '../document/defaults';
import { createDocument } from '../document/defaults';
import type { LightingSettings } from '../document/types';
import type { PixelBuffer } from './adjust';
import { applyLighting, artLight, imageAngle, type ArtLight } from './lighting';
import { artEdits, isUnedited } from './process';

const grey = (w = 40, h = 40, alpha: (x: number, y: number) => number = () => 255): PixelBuffer => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([128, 128, 128, alpha(x, y)], (y * w + x) * 4);
  return { data, width: w, height: h };
};
const px = (b: PixelBuffer, x: number, y: number) => Array.from(b.data.slice((y * b.width + x) * 4, (y * b.width + x) * 4 + 4));
const lum = (p: number[]) => 0.299 * p[0]! + 0.587 * p[1]! + 0.114 * p[2]!;
const light = (patch: Partial<ArtLight> = {}): ArtLight => ({
  angle: 90,
  color: '#ffffff',
  strength: 80,
  falloff: 70,
  rim: { enabled: false, strength: 0, width: 30, softness: 0 },
  ...patch,
});

describe('lighting', () => {
  it('the side facing the light is brighter than the side away from it', () => {
    for (const [angle, near, far] of [
      [90, [20, 38], [20, 1]], // from below
      [270, [20, 1], [20, 38]], // from above
      [0, [38, 20], [1, 20]], // from the right
      [180, [1, 20], [38, 20]], // from the left
    ] as const) {
      const b = grey();
      applyLighting(b, light({ angle }));
      expect(lum(px(b, near[0], near[1])), `angle ${angle}`).toBeGreaterThan(lum(px(b, far[0], far[1])) + 40);
    }
  });

  it('tints the art with the light colour', () => {
    const b = grey();
    applyLighting(b, light({ color: '#ff8020' }));
    const [r, g, bl] = px(b, 20, 30);
    expect(r).toBeGreaterThan(g!);
    expect(g).toBeGreaterThan(bl!);
  });

  it('more falloff makes the far side darker', () => {
    const soft = grey();
    const hard = grey();
    applyLighting(soft, light({ falloff: 0 }));
    applyLighting(hard, light({ falloff: 100 }));
    expect(lum(px(hard, 20, 1))).toBeLessThan(lum(px(soft, 20, 1)) - 20);
  });

  it('rim light brightens the cut-out edge facing the light, not the middle', () => {
    // An opaque disc on a see-through background, lit from the right.
    const disc = () => grey(60, 60, (x, y) => (Math.hypot(x - 30, y - 30) < 20 ? 255 : 0));
    const plain = disc();
    const rim = disc();
    applyLighting(plain, light({ angle: 0, strength: 0 }));
    applyLighting(rim, light({ angle: 0, strength: 0, rim: { enabled: true, strength: 100, width: 100, softness: 0 } }));
    expect(lum(px(rim, 48, 30))).toBeGreaterThan(lum(px(plain, 48, 30)) + 60); // right edge
    expect(lum(px(rim, 30, 30))).toBeCloseTo(lum(px(plain, 30, 30)), 0); // middle
    expect(lum(px(rim, 12, 30))).toBeCloseTo(lum(px(plain, 12, 30)), 0); // left edge, away from the light
    expect(px(rim, 2, 2)[3]).toBe(0); // see-through stays see-through
  });

  it('rim softness fades the rim into the art instead of a crisp band', () => {
    // 200 px wide: a crisp rim at full width is 5 px thick.
    const disc = () => grey(200, 200, (x, y) => (Math.hypot(x - 100, y - 100) < 80 ? 255 : 0));
    const lift = (softness: number, x: number) => {
      const plain = disc();
      const rim = disc();
      applyLighting(plain, light({ angle: 0, strength: 0 }));
      applyLighting(rim, light({ angle: 0, strength: 0, rim: { enabled: true, strength: 40, width: 100, softness } }));
      return lum(px(rim, x, 100)) - lum(px(plain, x, 100));
    };
    // Right at the edge both are bright.
    expect(lift(0, 179)).toBeGreaterThan(40);
    expect(lift(100, 179)).toBeGreaterThan(40);
    // A crisp rim is as bright inside its width as at the edge; a soft one fades.
    expect(Math.abs(lift(0, 176) - lift(0, 179))).toBeLessThan(5);
    expect(lift(100, 176)).toBeLessThan(lift(100, 179) - 10);
    // …and a soft rim still never reaches the middle.
    expect(lift(100, 100)).toBeCloseTo(0, 0);
  });

  it('turns the token direction into the picture direction when the art is rotated or flipped', () => {
    const t = { rotation: 0, flipX: false, flipY: false };
    expect(imageAngle(90, t)).toBe(90);
    expect(imageAngle(90, { ...t, rotation: 90 })).toBe(0); // art turned clockwise: "below" is the picture's right
    expect(imageAngle(0, { ...t, flipX: true })).toBe(180);
    expect(imageAngle(90, { ...t, flipY: true })).toBe(270);
  });

  it('is off by default and when strength and rim are both zero; artEdits carries it', () => {
    const doc = createDocument();
    expect(artLight(doc.lighting, doc.art.transform)).toBeNull();
    expect(isUnedited(artEdits(doc))).toBe(true);
    const on: LightingSettings = { ...DEFAULT_LIGHTING, enabled: true };
    expect(artLight({ ...on, strength: 0 }, doc.art.transform)).toBeNull();
    const lit = { ...doc, lighting: on };
    expect(artEdits(lit).light).toMatchObject({ angle: 225, strength: 50 });
    expect(isUnedited(artEdits(lit))).toBe(false);
    expect(artEdits(lit)).toBe(artEdits(lit)); // same document, same object (caches rely on it)
  });

  it('has the six presets from the design', () => {
    expect(LIGHT_PRESETS.map((p) => p.name)).toEqual(['Torchlight', 'Moonlight', 'Holy glow', 'Fel green', 'Firelight', 'Underdark']);
    expect(LIGHT_PRESETS.find((p) => p.id === 'torchlight')!.settings.direction).toBe(90); // from below
    expect(LIGHT_PRESETS.find((p) => p.id === 'moonlight')!.settings.direction).toBe(270); // from above
  });
});
