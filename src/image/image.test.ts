import { DEFAULT_ADJUST, DEFAULT_REMOVAL } from '../document/defaults';
import type { ImageAdjustments, MaskStroke } from '../document/types';
import { adjustColours, type PixelBuffer } from './adjust';
import { blurImage } from './filters';
import { createDocument } from '../document/defaults';
import { aiKeepMask, artEdits, editsKey, isUnedited, processPixels, setAiMaskLookup, type AiMask, type ArtEdits } from './process';
import { detectEdgeColor, removalMask } from './removal';
import { applyStrokes } from './strokes';

/** A w×h buffer filled by `fill(x, y)` → [r, g, b, a]. */
function make(w: number, h: number, fill: (x: number, y: number) => number[]): PixelBuffer {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fill(x, y), (y * w + x) * 4);
  return { data, width: w, height: h };
}
const px = (b: PixelBuffer, x: number, y: number) => [...b.data.slice((y * b.width + x) * 4, (y * b.width + x) * 4 + 4)];

/** One pixel through one adjustment. */
function one(rgb: number[], adjust: Partial<ImageAdjustments>): number[] {
  const b = make(1, 1, () => [...rgb, 255]);
  adjustColours(b, { ...DEFAULT_ADJUST, ...adjust });
  return px(b, 0, 0).slice(0, 3);
}
const chroma = (c: number[]) => Math.max(...c) - Math.min(...c);

const edits = (e: Partial<ArtEdits> = {}): ArtEdits => ({ adjust: { ...DEFAULT_ADJUST }, removal: { ...DEFAULT_REMOVAL }, strokes: [], ...e });

describe('adjustments (one pixel each)', () => {
  const mid = [128, 100, 80];

  it('leaves pixels exactly alone at zero', () => {
    expect(one(mid, {})).toEqual(mid);
    expect(isUnedited(edits())).toBe(true);
  });

  it('brightness raises and lowers every channel', () => {
    expect(one(mid, { brightness: 50 }).every((v, i) => v > mid[i]!)).toBe(true);
    expect(one(mid, { brightness: -50 }).every((v, i) => v < mid[i]!)).toBe(true);
  });

  it('contrast pushes tones away from (or towards) the middle', () => {
    expect(one([200, 200, 200], { contrast: 50 })[0]).toBeGreaterThan(200);
    expect(one([50, 50, 50], { contrast: 50 })[0]).toBeLessThan(50);
    expect(one([200, 200, 200], { contrast: -50 })[0]).toBeLessThan(200);
  });

  it('saturation adds or removes colour; -100 is grey', () => {
    expect(chroma(one(mid, { saturation: 50 }))).toBeGreaterThan(chroma(mid));
    const grey = one(mid, { saturation: -100 });
    expect(chroma(grey)).toBeLessThanOrEqual(1);
  });

  it('hue turns red towards cyan at 180°', () => {
    const [r, g, b] = one([200, 40, 40], { hue: 180 });
    expect(g!).toBeGreaterThan(r!);
    expect(b!).toBeGreaterThan(r!);
  });

  it('temperature warms (more red, less blue) and cools', () => {
    const warm = one(mid, { temperature: 100 });
    expect(warm[0]).toBeGreaterThan(mid[0]!);
    expect(warm[2]).toBeLessThan(mid[2]!);
    expect(one(mid, { temperature: -100 })[2]).toBeGreaterThan(mid[2]!);
  });

  it('tint moves between green and magenta', () => {
    expect(one(mid, { tint: 100 })[1]).toBeLessThan(mid[1]!);
    expect(one(mid, { tint: -100 })[1]).toBeGreaterThan(mid[1]!);
  });

  it('exposure works in stops: +50 roughly doubles the light', () => {
    const up = one([100, 100, 100], { exposure: 50 })[0]!;
    expect(up).toBeGreaterThan(130);
    expect(one([100, 100, 100], { exposure: -50 })[0]).toBeLessThan(80);
    expect(one([0, 0, 0], { exposure: 100 })[0]).toBe(0); // black stays black
  });

  it('shadows lift dark tones much more than bright ones', () => {
    const dark = one([30, 30, 30], { shadows: 100 })[0]! - 30;
    const bright = one([230, 230, 230], { shadows: 100 })[0]! - 230;
    expect(dark).toBeGreaterThan(40);
    expect(bright).toBeLessThan(5);
  });

  it('highlights change bright tones much more than dark ones', () => {
    const bright = 230 - one([230, 230, 230], { highlights: -100 })[0]!;
    const dark = 30 - one([30, 30, 30], { highlights: -100 })[0]!;
    expect(bright).toBeGreaterThan(60);
    expect(dark).toBeLessThan(5);
  });

  it('vibrance boosts dull colours more than strong ones', () => {
    const dull = [120, 110, 100];
    const strong = [230, 30, 30];
    const dullGain = chroma(one(dull, { vibrance: 100 })) / chroma(dull);
    const strongGain = chroma(one(strong, { vibrance: 100 })) / chroma(strong);
    expect(dullGain).toBeGreaterThan(strongGain);
  });

  it('grayscale 100 gives equal channels; 50 is half way', () => {
    const g = one([200, 40, 40], { grayscale: 100 });
    expect(chroma(g)).toBeLessThanOrEqual(1);
    expect(chroma(one([200, 40, 40], { grayscale: 50 }))).toBeCloseTo(80, -1);
  });

  it('sepia gives a warm brown', () => {
    const [r, g, b] = one([128, 128, 128], { sepia: 100 });
    expect(r!).toBeGreaterThan(g!);
    expect(g!).toBeGreaterThan(b!);
  });

  it('invert flips every channel and keeps alpha', () => {
    const b = make(1, 1, () => [10, 100, 250, 77]);
    adjustColours(b, { ...DEFAULT_ADJUST, invert: true });
    expect(px(b, 0, 0)).toEqual([245, 155, 5, 77]);
  });

  it('never changes alpha', () => {
    const b = make(2, 1, (x) => [100, 100, 100, x ? 0 : 128]);
    adjustColours(b, { ...DEFAULT_ADJUST, brightness: 80, hue: 90, sepia: 50, exposure: 30 });
    expect([px(b, 0, 0)[3], px(b, 1, 0)[3]]).toEqual([128, 0]);
  });
});

describe('blur and sharpness', () => {
  const edge = () => make(40, 4, (x) => (x < 20 ? [0, 0, 0, 255] : [255, 255, 255, 255]));

  it('blur softens a hard edge', () => {
    const out = processPixels(edge(), edits({ adjust: { ...DEFAULT_ADJUST, blur: 100 } })).pixels;
    const left = px(out, 19, 1)[0]!;
    const right = px(out, 20, 1)[0]!;
    expect(left).toBeGreaterThan(20);
    expect(right).toBeLessThan(235);
    expect(px(out, 0, 1)[0]).toBe(0); // far from the edge stays put
  });

  it('sharpness makes an edge stronger (overshoot either side)', () => {
    const soft = make(40, 4, (x) => [x < 20 ? 80 : 170, x < 20 ? 80 : 170, x < 20 ? 80 : 170, 255]);
    blurImage(soft, 1.5);
    const before = px(soft, 21, 1)[0]! - px(soft, 18, 1)[0]!;
    const out = processPixels(soft, edits({ adjust: { ...DEFAULT_ADJUST, sharpness: 100 } })).pixels;
    expect(px(out, 21, 1)[0]! - px(out, 18, 1)[0]!).toBeGreaterThan(before);
  });

  it('blur does not darken the edges of a transparent picture', () => {
    const dot = make(21, 21, (x, y) => (Math.hypot(x - 10, y - 10) < 6 ? [255, 255, 255, 255] : [0, 0, 0, 0]));
    blurImage(dot, 2);
    const edgePx = px(dot, 16, 10);
    expect(edgePx[3]!).toBeGreaterThan(0);
    expect(edgePx[0]).toBe(255); // still white, only more see-through
  });
});

// A goblin-green figure in the middle of a flat white background, with a
// white "shield" inside it that is not connected to the edges.
const figure = () =>
  make(60, 60, (x, y) => {
    const inFigure = x >= 15 && x < 45 && y >= 10 && y < 55;
    const inShield = x >= 25 && x < 35 && y >= 25 && y < 35;
    return inShield ? [250, 250, 250, 255] : inFigure ? [60, 140, 50, 255] : [252, 252, 250, 255];
  });
const maskAt = (m: Uint8Array, x: number, y: number) => m[y * 60 + x]!;

describe('flat background removal', () => {
  it('finds the background colour from the edges', () => {
    expect(detectEdgeColor(figure())).toEqual([252, 252, 250]);
  });

  it('removes the background but keeps the figure and the enclosed shield', () => {
    const m = removalMask(figure(), { color: null, intensity: 20, softness: 0 });
    expect(maskAt(m, 2, 2)).toBe(0);
    expect(maskAt(m, 58, 58)).toBe(0);
    expect(maskAt(m, 30, 15)).toBe(255);
    expect(maskAt(m, 30, 30)).toBe(255); // the shield is not connected to the edge
  });

  it('removes nothing when the chosen colour is not on the edges', () => {
    const m = removalMask(figure(), { color: [255, 0, 255], intensity: 20, softness: 0 });
    expect(m.every((v) => v === 255)).toBe(true);
  });

  it('intensity 0 only takes near-exact matches', () => {
    const noisy = make(20, 20, (x, y) => (x < 10 ? [250, 250, 250, 255] : [235, 235, 235, 255]).map((v, i) => (i < 3 ? v - ((x + y) % 2) : v)));
    const strict = removalMask(noisy, { color: [250, 250, 250], intensity: 0, softness: 0 });
    const loose = removalMask(noisy, { color: [250, 250, 250], intensity: 30, softness: 0 });
    expect(strict.filter((v) => v === 0).length).toBeLessThan(loose.filter((v) => v === 0).length);
    expect(loose.every((v) => v === 0)).toBe(true);
  });

  it('edge softness makes a gradual edge', () => {
    const hard = removalMask(figure(), { color: null, intensity: 20, softness: 0 });
    const soft = removalMask(figure(), { color: null, intensity: 20, softness: 100 });
    const partial = (m: Uint8Array) => m.filter((v) => v > 0 && v < 255).length;
    expect(partial(soft)).toBeGreaterThan(partial(hard));
  });

  it('keeps the original pixels: only alpha changes in the result', () => {
    const src = figure();
    const copy = src.data.slice();
    const { pixels, mask } = processPixels(src, edits({ removal: { ...DEFAULT_REMOVAL, enabled: true, softness: 0 } }));
    expect(src.data).toEqual(copy);
    expect(mask).not.toBeNull();
    expect(px(pixels, 2, 2)).toEqual([252, 252, 250, 0]);
    expect(px(pixels, 30, 15)).toEqual([60, 140, 50, 255]);
  });
});

describe('enclosed gaps (v8)', () => {
  // White background; a green ring whose white middle (r < 12) is cut off from the edge; a 1 px white speck.
  const ring = make(60, 60, (x, y) => {
    const r = Math.hypot(x - 30, y - 30);
    if (x === 30 && y === 49) return [255, 255, 255, 255];
    return r < 12 || r > 22 ? [255, 255, 255, 255] : [40, 140, 60, 255];
  });
  const opts = { color: null, intensity: 20, softness: 0 };

  it('off: only the background joined to the edge goes', () => {
    const m = removalMask(ring, { ...opts, enclosed: false });
    expect(m[2 * 60 + 2]).toBe(0);
    expect(m[30 * 60 + 30]).toBe(255);
  });

  it('on: the enclosed gap goes too, but specks smaller than a little patch stay', () => {
    const m = removalMask(ring, { ...opts, enclosed: true });
    expect(m[2 * 60 + 2]).toBe(0);
    expect(m[30 * 60 + 30]).toBe(0);
    expect(m[49 * 60 + 30]).toBe(255);
    expect(m[30 * 60 + 47]).toBe(255); // the ring itself
  });
});

describe('AI cut-out (v8)', () => {
  // A 2 × 2 mask: keep the left column, remove the right.
  const mask: AiMask = { id: 7, width: 2, height: 2, data: Uint8Array.from([255, 0, 255, 0]) };

  it('is stretched to the picture, with nothing removed until it is ready', () => {
    const out = aiKeepMask(mask, 8, 8, 0);
    expect(out[0]).toBe(255);
    expect(out[7]).toBe(0);
    expect(out[4 * 8 + 3]! > out[4 * 8 + 4]!).toBe(true); // a smooth step between
    expect([...aiKeepMask(null, 4, 4, 0)].every((v) => v === 255)).toBe(true);
  });

  it("is the picture's own: the document's art finds its mask by asset id, and a new mask makes new edits", () => {
    const doc = createDocument();
    doc.art.assetId = 'asset:a';
    doc.art.removal = { ...doc.art.removal, enabled: true, method: 'ai' };
    let current: AiMask | null = null;
    setAiMaskLookup((id) => (id === 'asset:a' ? current : null));
    const before = artEdits(doc);
    expect(before.aiMask).toBeNull();
    current = mask;
    const after = artEdits(doc);
    expect(after.aiMask).toBe(mask);
    expect(editsKey(after)).not.toBe(editsKey(before));
    // Flat-colour removal ignores the AI mask.
    expect(artEdits({ ...doc, art: { ...doc.art, removal: { ...doc.art.removal, method: 'colour' } } }).aiMask).toBeNull();
    setAiMaskLookup(() => null);
  });

  it('removes what the mask says through the whole pipeline', () => {
    const pic = make(8, 8, () => [200, 100, 50, 255]);
    const { pixels } = processPixels(pic, edits({ removal: { ...DEFAULT_REMOVAL, enabled: true, method: 'ai', softness: 0 }, aiMask: mask }));
    expect(px(pixels, 0, 0)[3]).toBe(255);
    expect(px(pixels, 7, 0)[3]).toBe(0);
  });
});

describe('erase and restore brush', () => {
  const line = (mode: MaskStroke['mode'], softness = 0, points = [0.1, 0.5, 1, 0.9, 0.5, 1]): MaskStroke => ({ mode, size: 0.2, softness, points });

  it('erases along the stroke and nowhere else', () => {
    const m = new Uint8Array(100 * 100).fill(255);
    applyStrokes(m, 100, 100, [line('erase')]);
    expect(m[50 * 100 + 50]).toBe(0);
    expect(m[50 * 100 + 15]).toBe(0);
    expect(m[10 * 100 + 50]).toBe(255);
  });

  it('restores what was erased, in order', () => {
    const m = new Uint8Array(100 * 100).fill(255);
    applyStrokes(m, 100, 100, [line('erase'), line('restore', 0, [0.5, 0.5, 1])]);
    expect(m[50 * 100 + 50]).toBe(255);
    expect(m[50 * 100 + 20]).toBe(0);
  });

  it('a soft brush fades out at its rim, a hard one does not', () => {
    const hard = new Uint8Array(100 * 100).fill(255);
    const soft = new Uint8Array(100 * 100).fill(255);
    applyStrokes(hard, 100, 100, [line('erase', 0)]);
    applyStrokes(soft, 100, 100, [line('erase', 1)]);
    const rim = 50 * 100 + 50 + 100 * 8; // 8 px below the line, inside its 10 px radius
    expect(hard[rim]).toBe(0);
    expect(soft[rim]!).toBeGreaterThan(100);
  });

  it('light pen pressure paints a thinner line', () => {
    const light = new Uint8Array(100 * 100).fill(255);
    applyStrokes(light, 100, 100, [line('erase', 0, [0.1, 0.5, 0.1, 0.9, 0.5, 0.1])]);
    expect(light[50 * 100 + 50]).toBe(0);
    expect(light[(50 + 6) * 100 + 50]).toBe(255);
  });

  it('strokes land on the same part of the picture at any resolution', () => {
    const small = new Uint8Array(50 * 50).fill(255);
    applyStrokes(small, 50, 50, [line('erase')]);
    expect(small[25 * 50 + 25]).toBe(0);
    expect(small[5 * 50 + 25]).toBe(255);
  });

  it('removal plus brush: restoring brings back removed background', () => {
    const e = edits({
      removal: { ...DEFAULT_REMOVAL, enabled: true, softness: 0 },
      strokes: [{ mode: 'restore', size: 0.1, softness: 0, points: [0.05, 0.05, 1] }],
    });
    const { pixels } = processPixels(figure(), e);
    expect(px(pixels, 2, 2)[3]).toBe(255);
    expect(px(pixels, 58, 2)[3]).toBe(0);
  });

  it('a growing stroke gives the same result with or without the cache', () => {
    const cache = {};
    const base = edits({ removal: { ...DEFAULT_REMOVAL, enabled: true } });
    const first: MaskStroke = { mode: 'erase', size: 0.1, softness: 0.5, points: [0.3, 0.3, 1] };
    const growing: MaskStroke = { ...first, points: [0.3, 0.3, 1, 0.5, 0.5, 1] };
    const done: MaskStroke = { ...first, points: [0.3, 0.3, 1, 0.5, 0.5, 1, 0.7, 0.4, 1] };
    processPixels(figure(), { ...base, strokes: [first] }, cache);
    processPixels(figure(), { ...base, strokes: [first, growing] }, cache);
    const cached = processPixels(figure(), { ...base, strokes: [first, done] }, cache);
    const fresh = processPixels(figure(), { ...base, strokes: [first, done] });
    expect(cached.mask).toEqual(fresh.mask);
    expect(cached.pixels.data).toEqual(fresh.pixels.data);
  });

  it('the cache key changes with every input', () => {
    const a = edits();
    expect(editsKey(a)).toBe(editsKey(edits()));
    expect(editsKey(a)).not.toBe(editsKey(edits({ adjust: { ...DEFAULT_ADJUST, hue: 1 } })));
    expect(editsKey(a)).not.toBe(editsKey(edits({ strokes: [line('erase')] })));
    // Removal settings only matter while removal is on.
    expect(editsKey(a)).toBe(editsKey(edits({ removal: { ...DEFAULT_REMOVAL, intensity: 90 } })));
  });
});
