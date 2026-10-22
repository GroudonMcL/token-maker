// @vitest-environment node
// Pixel tests for the image maths: every adjustment, background removal and the brush.
import { DEFAULT_ADJUST, DEFAULT_REMOVAL } from '../document/defaults';
import type { BrushStroke, ImageAdjustments } from '../document/types';
import { adjustPixels, isNeutral, type PixelBuffer } from './adjust';
import { applyStrokes, paintCoverage, applyCoverage } from './brush';
import { detectBackground, removalMask } from './removal';

/** A w×h buffer filled by `fill(x, y)` → [r, g, b, a]. */
function buffer(w: number, h: number, fill: (x: number, y: number) => [number, number, number, number]): PixelBuffer {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fill(x, y), (y * w + x) * 4);
  return { data, width: w, height: h };
}
const solid = (r: number, g: number, b: number) => buffer(4, 4, () => [r, g, b, 255]);
const px = (buf: PixelBuffer, x = 0, y = 0) => Array.from(buf.data.slice((y * buf.width + x) * 4, (y * buf.width + x) * 4 + 4));
const adjust = (buf: PixelBuffer, patch: Partial<ImageAdjustments>) => adjustPixels(buf, { ...DEFAULT_ADJUST, ...patch });
const lum = ([r, g, b]: number[]) => 0.299 * r! + 0.587 * g! + 0.114 * b!;
const chroma = ([r, g, b]: number[]) => Math.max(r!, g!, b!) - Math.min(r!, g!, b!);

describe('adjustments', () => {
  const mid = solid(120, 100, 80);

  it('neutral settings change nothing and never touch the input', () => {
    expect(isNeutral(DEFAULT_ADJUST)).toBe(true);
    const out = adjustPixels(mid, DEFAULT_ADJUST);
    expect(out.data).toEqual(mid.data);
    expect(out.data).not.toBe(mid.data);
    adjust(mid, { brightness: 80, blur: 50 });
    expect(px(mid)).toEqual([120, 100, 80, 255]);
  });

  it('brightness lightens and darkens', () => {
    expect(lum(px(adjust(mid, { brightness: 50 })))).toBeGreaterThan(lum(px(mid)) + 40);
    expect(lum(px(adjust(mid, { brightness: -50 })))).toBeLessThan(lum(px(mid)) - 40);
  });

  it('contrast pushes tones away from (or towards) the middle', () => {
    const dark = solid(60, 60, 60);
    expect(px(adjust(dark, { contrast: 60 }))[0]).toBeLessThan(40);
    expect(px(adjust(dark, { contrast: -60 }))[0]).toBeGreaterThan(80);
  });

  it('saturation and vibrance change colourfulness; vibrance favours dull colours', () => {
    expect(chroma(px(adjust(mid, { saturation: 80 })))).toBeGreaterThan(chroma(px(mid)));
    expect(chroma(px(adjust(mid, { saturation: -100 })))).toBeLessThanOrEqual(1);
    const vivid = solid(250, 20, 20);
    const dullGain = chroma(px(adjust(mid, { vibrance: 80 }))) / chroma(px(mid));
    const vividGain = chroma(px(adjust(vivid, { vibrance: 80 }))) / chroma(px(vivid));
    expect(dullGain).toBeGreaterThan(vividGain);
    expect(chroma(px(adjust(mid, { vibrance: -100 })))).toBeLessThan(chroma(px(mid)));
  });

  it('hue turns red towards green and blue', () => {
    const red = solid(220, 30, 30);
    const [r, g] = px(adjust(red, { hue: 120 }));
    expect(g).toBeGreaterThan(r!);
    const [r2, , b2] = px(adjust(red, { hue: -120 }));
    expect(b2).toBeGreaterThan(r2!);
  });

  it('temperature warms or cools; tint goes magenta or green', () => {
    const grey = solid(128, 128, 128);
    const [wr, , wb] = px(adjust(grey, { temperature: 80 }));
    expect(wr).toBeGreaterThan(wb!);
    const [cr, , cb] = px(adjust(grey, { temperature: -80 }));
    expect(cb).toBeGreaterThan(cr!);
    const [mr, mg] = px(adjust(grey, { tint: 80 }));
    expect(mr).toBeGreaterThan(mg!);
    const [gr, gg] = px(adjust(grey, { tint: -80 }));
    expect(gg).toBeGreaterThan(gr!);
  });

  it('exposure works in stops: +100 is brighter, −100 darker', () => {
    expect(px(adjust(mid, { exposure: 100 }))[0]).toBeGreaterThan(160);
    expect(px(adjust(mid, { exposure: -100 }))[0]).toBeLessThan(80);
  });

  it('shadows move dark tones much more than light ones; highlights the reverse', () => {
    const dark = solid(40, 40, 40);
    const light = solid(220, 220, 220);
    const gain = (b: PixelBuffer, p: Partial<ImageAdjustments>) => px(adjust(b, p))[0]! - px(b)[0]!;
    expect(gain(dark, { shadows: 100 })).toBeGreaterThan(gain(light, { shadows: 100 }) + 10);
    expect(-gain(light, { highlights: -100 })).toBeGreaterThan(-gain(dark, { highlights: -100 }) + 10);
  });

  it('blur softens a hard edge and sharpness makes it harsher', () => {
    const edge = buffer(40, 8, (x) => (x < 20 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const blurred = adjust(edge, { blur: 100 });
    expect(px(blurred, 19, 4)[0]).toBeGreaterThan(40);
    expect(px(blurred, 20, 4)[0]).toBeLessThan(215);
    const grey = buffer(40, 8, (x) => (x < 20 ? [90, 90, 90, 255] : [160, 160, 160, 255]));
    const sharp = adjust(grey, { sharpness: 100 });
    expect(px(sharp, 19, 4)[0]).toBeLessThan(90);
    expect(px(sharp, 20, 4)[0]).toBeGreaterThan(160);
  });

  it('blurring next to transparent pixels does not darken colours', () => {
    const half = buffer(20, 4, (x) => (x < 10 ? [255, 255, 255, 255] : [0, 0, 0, 0]));
    const [r, g, b, a] = px(adjust(half, { blur: 100 }), 9, 2);
    expect(a).toBeLessThan(255);
    expect(Math.min(r!, g!, b!)).toBeGreaterThan(245);
  });

  it('grayscale, sepia and invert', () => {
    expect(chroma(px(adjust(mid, { grayscale: 100 })))).toBeLessThanOrEqual(1);
    const [sr, sg, sb] = px(adjust(solid(128, 128, 128), { sepia: 100 }));
    expect(sr).toBeGreaterThan(sg!);
    expect(sg).toBeGreaterThan(sb!);
    expect(px(adjust(mid, { invert: true }))).toEqual([135, 155, 175, 255]);
  });
});

// A 40×40 picture: flat green background with a red square subject, plus a
// green "hole" inside the subject that doesn't touch the background.
const scene = () =>
  buffer(40, 40, (x, y) => {
    const inSubject = x >= 10 && x < 30 && y >= 10 && y < 30;
    const hole = x >= 18 && x < 22 && y >= 18 && y < 22;
    return inSubject && !hole ? [200, 30, 30, 255] : [40, 200, 60, 255];
  });
const on = { ...DEFAULT_REMOVAL, enabled: true, softness: 0 };

describe('background removal', () => {
  it('finds the background colour from the corners', () => {
    expect(detectBackground(scene())).toBe('#28c83c');
  });

  it('removes the background connected to the edges and keeps the subject and its inner hole', () => {
    const mask = removalMask(scene(), on);
    expect(mask[2 * 40 + 2]).toBe(0);
    expect(mask[15 * 40 + 15]).toBe(255);
    expect(mask[20 * 40 + 20]).toBe(255); // enclosed: not touching the edge
  });

  it('the eyedropper point also removes an enclosed area', () => {
    const mask = removalMask(scene(), { ...on, color: '#28c83c', seed: { x: 20 / 40, y: 20 / 40 } });
    expect(mask[20 * 40 + 20]).toBe(0);
  });

  it('is off when disabled, and never changes the original pixels', () => {
    const img = scene();
    const copy = new Uint8ClampedArray(img.data);
    expect(removalMask(img, DEFAULT_REMOVAL).every((v) => v === 255)).toBe(true);
    removalMask(img, on);
    expect(img.data).toEqual(copy);
  });

  it('intensity decides how different a colour may be and still go', () => {
    const shaded = buffer(40, 40, (x) => (x < 20 ? [40, 200, 60, 255] : [70, 170, 90, 255]));
    expect(removalMask(shaded, { ...on, intensity: 5 })[35]).toBe(255);
    expect(removalMask(shaded, { ...on, intensity: 40 })[35]).toBe(0);
  });

  it('edge softness fades the subject edge inwards, never leaving a halo', () => {
    const big = buffer(200, 200, (x, y) => (x >= 50 && x < 150 && y >= 50 && y < 150 ? [200, 30, 30, 255] : [40, 200, 60, 255]));
    const hard = removalMask(big, on);
    const soft = removalMask(big, { ...on, softness: 100 });
    expect(hard[100 * 200 + 50]).toBe(255);
    expect(soft[100 * 200 + 50]).toBeLessThan(255);
    expect(soft[100 * 200 + 48]).toBe(0);
    expect(soft[100 * 200 + 100]).toBe(255);
  });
});

describe('brush', () => {
  const stroke = (mode: BrushStroke['mode'], points: number[], radius = 0.05, softness = 0): BrushStroke => ({ id: mode, mode, radius, softness, points });

  it('erase removes along the line and restore brings it back', () => {
    const mask = new Uint8Array(100 * 100).fill(255);
    applyStrokes(mask, 100, 100, [stroke('erase', [0.2, 0.5, 1, 0.8, 0.5, 1])]);
    expect(mask[50 * 100 + 50]).toBe(0);
    expect(mask[50 * 100 + 25]).toBe(0);
    expect(mask[10 * 100 + 50]).toBe(255);
    applyStrokes(mask, 100, 100, [stroke('restore', [0.5, 0.5, 1])]);
    expect(mask[50 * 100 + 50]).toBe(255);
    expect(mask[50 * 100 + 25]).toBe(0);
  });

  it('restore also brings back what background removal took', () => {
    const mask = removalMask(scene(), on);
    applyStrokes(mask, 40, 40, [stroke('restore', [0.05, 0.05, 1], 0.05)]);
    expect(mask[2 * 40 + 2]).toBe(255);
  });

  it('a soft brush fades at its edge, and does not build up within one stroke', () => {
    const mask = new Uint8Array(100 * 100).fill(255);
    const back = [0.5, 0.5, 1, 0.52, 0.5, 1, 0.5, 0.5, 1, 0.52, 0.5, 1];
    applyStrokes(mask, 100, 100, [stroke('erase', back, 0.1, 1)]);
    const edge = mask[50 * 100 + 50 + 8]!;
    expect(edge).toBeGreaterThan(30);
    expect(edge).toBeLessThan(255);
    const once = new Uint8Array(100 * 100).fill(255);
    applyStrokes(once, 100, 100, [stroke('erase', back.slice(0, 6), 0.1, 1)]);
    expect(Math.abs(once[50 * 100 + 50 + 8]! - edge)).toBeLessThanOrEqual(1);
  });

  it('light pen pressure makes a smaller mark', () => {
    const hardPress = new Uint8Array(100 * 100).fill(255);
    const light = new Uint8Array(100 * 100).fill(255);
    applyStrokes(hardPress, 100, 100, [stroke('erase', [0.5, 0.5, 1], 0.1)]);
    applyStrokes(light, 100, 100, [stroke('erase', [0.5, 0.5, 0.1], 0.1)]);
    expect(hardPress[50 * 100 + 57]).toBe(0);
    expect(light[50 * 100 + 57]).toBe(255);
  });

  it('painting a stroke bit by bit gives the same mask as painting it at once', () => {
    const s = stroke('erase', [0.1, 0.1, 1, 0.5, 0.3, 0.6, 0.9, 0.8, 1], 0.06, 0.5);
    const whole = new Uint8Array(100 * 100).fill(255);
    applyStrokes(whole, 100, 100, [s]);
    const live = new Uint8Array(100 * 100).fill(255);
    const before = live.slice();
    const cov = new Uint8Array(100 * 100);
    for (let n = 1; n <= 3; n++) {
      const part = { ...s, points: s.points.slice(0, n * 3) };
      const rect = paintCoverage(cov, 100, 100, part, n - 1);
      if (rect) applyCoverage(live, before, cov, 100, 'erase', rect);
    }
    expect(live).toEqual(whole);
  });
});
