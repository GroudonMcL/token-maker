// @vitest-environment node
// Pixel-level checks of the renderer, drawn with @napi-rs/canvas.
import { createCanvas } from '@napi-rs/canvas';
import { createDocument } from '../document/defaults';
import { outputSize } from '../document/sizing';
import type { TokenDocument } from '../document/types';
import { FRAME_PRESETS, SHAPES } from './catalog';
import type { Ctx } from './frameKit';
import { renderToken, type RenderSource } from './render';
import { sampleArt } from './sampleArt';
import { DEFAULT_ADJUST, DEFAULT_REMOVAL } from '../document/defaults';
import type { ArtLayer, BrushStroke } from '../document/types';
import { needsHeavyWork, processArt, setCanvasFactory } from '../image/processArt';

setCanvasFactory((w, h) => createCanvas(w, h) as unknown as HTMLCanvasElement);

const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;

function solid(color: string, w = 200, h = 200): RenderSource {
  const c = make(w, h);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return { image: c, width: w, height: h };
}

function halves(left: string, right: string): RenderSource {
  const c = make(200, 200);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, 100, 200);
  ctx.fillStyle = right;
  ctx.fillRect(100, 0, 100, 200);
  return { image: c, width: 200, height: 200 };
}

function draw(doc: TokenDocument, art: RenderSource | null, size = outputSize(doc.size.squares), opts?: Parameters<typeof renderToken>[4]) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const assets = new Map(art ? [['asset:a', art]] : []);
  renderToken(ctx as unknown as Ctx, { ...doc, art: { ...doc.art, assetId: art ? 'asset:a' : null } }, assets, size, opts);
  const data = ctx.getImageData(0, 0, size, size).data;
  const at = (x: number, y: number) => {
    const i = (Math.round(y) * size + Math.round(x)) * 4;
    return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!] as const;
  };
  return { size, data, at, canvas };
}

const doc = (patch: Partial<TokenDocument> = {}) => ({ ...createDocument(), ...patch });

describe('renderer', () => {
  it.each(FRAME_PRESETS.filter((p) => p.style !== 'none').map((p) => [p.name, p] as const))(
    '%s draws a band around the art, the same every time',
    (_name, preset) => {
      const d = doc({ frame: { ...createDocument().frame, presetId: preset.id, style: preset.style, color: preset.color } });
      const a = draw(d, solid('#ff0000'));
      const b = draw(d, solid('#ff0000'));
      expect(Buffer.compare(Buffer.from(a.data), Buffer.from(b.data))).toBe(0); // deterministic
      // The centre is art, the band (between 0.10 and 0.24 of R from the edge) is not plain art.
      expect(a.at(128, 128)).toEqual([255, 0, 0, 255]);
      const bandX = 128 - 128 * (1 - 0.17);
      const [r, g, bl, alpha] = a.at(bandX, 128);
      expect(alpha).toBeGreaterThan(200);
      expect([r, g, bl]).not.toEqual([255, 0, 0]);
    },
  );

  it('no frame: the art reaches the clip edge and nothing else is drawn', () => {
    const d = doc({ frame: { ...createDocument().frame, style: 'none', presetId: 'none', backingOpacity: 0 } });
    d.shadows.outer.enabled = false;
    const img = draw(d, solid('#00ff00'));
    expect(img.at(128, 30)).toEqual([0, 255, 0, 255]);
    expect(img.at(2, 2)[3]).toBe(0);
  });

  it.each(SHAPES.map((s) => s.id))('%s shape clips the art and leaves the corners clear', (shape) => {
    const d = doc({ shape });
    d.shadows.outer.enabled = false;
    const img = draw(d, solid('#0000ff'));
    expect(img.at(128, 128)).toEqual([0, 0, 255, 255]);
    if (shape !== 'square') expect(img.at(3, 3)[3]).toBe(0);
  });

  it('a Large token has the same border thickness in pixels as a Medium one', () => {
    const band = (squares: number) => {
      const d = doc({ size: { preset: 'custom', squares } });
      d.shadows.outer.enabled = false;
      d.shadows.inner.enabled = false;
      const img = draw(d, solid('#ff00ff'));
      const y = img.size / 2;
      let start = -1;
      let end = -1;
      for (let x = 0; x < img.size / 2; x++) {
        const [r, g, b, a] = img.at(x, y);
        if (start < 0 && a > 128) start = x;
        if (start >= 0 && r > 240 && g < 15 && b > 240) {
          end = x;
          break;
        }
      }
      return { start, end };
    };
    const medium = band(1);
    const large = band(2);
    const huge = band(3);
    // Outer spacing and the visible band are equal in pixels at 256 px per square.
    expect(Math.abs(large.start - medium.start)).toBeLessThanOrEqual(1);
    expect(Math.abs(large.end - large.start - (medium.end - medium.start))).toBeLessThanOrEqual(2);
    expect(Math.abs(huge.end - huge.start - (medium.end - medium.start))).toBeLessThanOrEqual(2);
  });

  it('casts the outer shadow away from the light (down and right by default)', () => {
    const img = draw(doc(), solid('#ffffff'));
    // Just outside the frame: bottom-right is in shadow, top-left is not.
    const r = 128 * 0.9 + 4;
    const br = img.at(128 + r * Math.SQRT1_2, 128 + r * Math.SQRT1_2)[3];
    const tl = img.at(128 - r * Math.SQRT1_2, 128 - r * Math.SQRT1_2)[3];
    expect(br).toBeGreaterThan(tl + 20);
  });

  it('the inner shadow darkens the art near the frame', () => {
    const on = draw(doc(), solid('#ffffff'));
    const offDoc = doc();
    offDoc.shadows = { ...offDoc.shadows, inner: { ...offDoc.shadows.inner, enabled: false } };
    const off = draw(offDoc, solid('#ffffff'));
    // A point on the art just inside the frame's inner edge, top left.
    const r = 128 * (1 - 0.25);
    const p = [128 - r * Math.SQRT1_2, 128 - r * Math.SQRT1_2] as const;
    expect(on.at(...p)[0]).toBeLessThan(off.at(...p)[0] - 10);
  });

  it('flips the art', () => {
    const plain = doc();
    const flipped = doc({ art: { ...plain.art, transform: { ...plain.art.transform, flipX: true } } });
    expect(draw(plain, halves('#ff0000', '#0000ff')).at(90, 128).slice(0, 3)).toEqual([255, 0, 0]);
    expect(draw(flipped, halves('#ff0000', '#0000ff')).at(90, 128).slice(0, 3)).toEqual([0, 0, 255]);
  });

  it('backing shows through transparent art; at 0% opacity it is clear', () => {
    const clear = { image: make(10, 10), width: 10, height: 10 };
    const d = doc({ frame: { ...createDocument().frame, backingColor: '#00ff00' } });
    d.shadows.inner.enabled = false;
    expect(draw(d, clear).at(128, 128)).toEqual([0, 255, 0, 255]);
    const none = doc({ frame: { ...createDocument().frame, backingOpacity: 0 } });
    expect(draw(none, clear).at(128, 128)[3]).toBe(0);
  });

  it('the Frame highlights colour recolours only frames that have highlights', () => {
    const frameOf = (style: TokenDocument['frame']['style'], highlightColor: string | null) =>
      doc({ frame: { ...createDocument().frame, presetId: style, style, color: '#c4622c', highlightColor } });
    const differs = (a: ReturnType<typeof draw>, b: ReturnType<typeof draw>) => Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) !== 0;
    const art = solid('#808080');
    // Monk's jade beads turn red; leaving it unset is the same as picking the default jade.
    expect(differs(draw(frameOf('beads', null), art), draw(frameOf('beads', '#ff0000'), art))).toBe(true);
    expect(differs(draw(frameOf('beads', null), art), draw(frameOf('beads', '#3d8c6a'), art))).toBe(false);
    // Stamped has no highlights, so the setting changes nothing.
    expect(differs(draw(frameOf('stamped', null), art), draw(frameOf('stamped', '#ff0000'), art))).toBe(false);
  });

  it('renders the same picture at any resolution (preview vs export)', () => {
    const d = doc();
    const small = draw(d, sampleArt(make), 128);
    const big = draw(d, sampleArt(make), 512);
    for (const [x, y] of [
      [64, 64],
      [64, 40],
      [30, 64],
    ]) {
      const a = small.at(x, y);
      const b = big.at(x * 4 + 1.5, y * 4 + 1.5);
      for (let i = 0; i < 4; i++) expect(Math.abs(a[i]! - b[i]!)).toBeLessThan(30);
    }
  });
});

/** A figure (red disc) on a flat green background. */
function figureOnGreen(size = 200): RenderSource {
  const c = make(size, size);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#28c83c';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#c81e1e';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.22, 0, Math.PI * 2);
  ctx.fill();
  return { image: c, width: size, height: size };
}

const withArt = (patch: Partial<ArtLayer>, base = createDocument()) =>
  ({ ...base, frame: { ...base.frame, style: 'none' as const, backingOpacity: 0 }, shadows: { ...base.shadows, outer: { ...base.shadows.outer, enabled: false } }, art: { ...base.art, ...patch } });

describe('processed art (Phase 3)', () => {
  const removeGreen = { removal: { ...DEFAULT_REMOVAL, enabled: true, softness: 0 } };

  it('adjustments change the token and the original image is untouched', () => {
    const art = solid('#806040');
    const plain = draw(withArt({}), art).at(128, 128);
    const bright = draw(withArt({ adjust: { ...DEFAULT_ADJUST, brightness: 60 } }), art).at(128, 128);
    expect(bright[0]).toBeGreaterThan(plain[0] + 40);
    expect(draw(withArt({}), art).at(128, 128)).toEqual(plain);
  });

  it('background removal makes the background see-through and keeps the figure', () => {
    const out = draw(withArt(removeGreen), figureOnGreen());
    expect(out.at(128, 128)).toEqual([200, 30, 30, 255]);
    expect(out.at(128, 60)[3]).toBe(0);
  });

  it('erase and restore strokes, in the art image\'s own coordinates', () => {
    const erase: BrushStroke = { id: 'e', mode: 'erase', radius: 0.05, softness: 0, points: [0.5, 0.5, 1] };
    const restore: BrushStroke = { id: 'r', mode: 'restore', radius: 0.05, softness: 0, points: [0.5, 0.2, 1] };
    const out = draw(withArt({ ...removeGreen, strokes: [erase, restore] }), figureOnGreen());
    expect(out.at(128, 128)[3]).toBe(0); // the figure's middle was erased
    expect(out.at(128, 128 - 0.3 * 256 * 0.98)[3]).toBe(255); // background brought back near the top
  });

  it('the brush follows the art when it is flipped', () => {
    const erase: BrushStroke = { id: 'e', mode: 'erase', radius: 0.08, softness: 0, points: [0.3, 0.5, 1] };
    const t = createDocument().art.transform;
    const left = draw(withArt({ strokes: [erase] }), figureOnGreen());
    const flipped = draw(withArt({ strokes: [erase], transform: { ...t, flipX: true } }), figureOnGreen());
    const x = 128 - 0.2 * 256 * 0.98;
    expect(left.at(x, 128)[3]).toBe(0);
    expect(flipped.at(x, 128)[3]).toBe(255);
    expect(flipped.at(256 - x, 128)[3]).toBe(0);
  });

  it('a low-resolution preview looks like the full export', () => {
    const d = withArt({ ...removeGreen, adjust: { ...DEFAULT_ADJUST, contrast: 30, blur: 20, hue: 40 } });
    const art = figureOnGreen(400);
    const full = draw(d, art);
    const preview = draw(d, art, undefined, { artMaxSide: 120 });
    for (const [x, y] of [[128, 128], [128, 70], [90, 128]] as const) {
      const a = full.at(x, y);
      const b = preview.at(x, y);
      for (let i = 0; i < 4; i++) expect(Math.abs(a[i]! - b[i]!)).toBeLessThan(25);
    }
  });

  it('a stroke painted as it is drawn ends up the same as painting it in one go, and undo rebuilds', () => {
    const art = figureOnGreen();
    const settings = { adjust: DEFAULT_ADJUST, removal: removeGreen.removal, strokes: [] as BrushStroke[] };
    const pts = [0.2, 0.3, 1, 0.5, 0.5, 0.7, 0.8, 0.4, 1];
    processArt(art, settings);
    let strokes: BrushStroke[] = [];
    for (let n = 1; n <= 3; n++) {
      strokes = [{ id: 's', mode: 'erase', radius: 0.04, softness: 0.4, points: pts.slice(0, n * 3) }];
      processArt(art, { ...settings, strokes });
    }
    const live = readPixels(processArt(art, { ...settings, strokes }));
    const fresh = readPixels(processArt(figureOnGreen(), { ...settings, strokes }));
    expect(Buffer.compare(Buffer.from(live), Buffer.from(fresh))).toBe(0);
    const undone = readPixels(processArt(art, settings));
    expect(Buffer.compare(Buffer.from(undone), Buffer.from(readPixels(processArt(figureOnGreen(), settings))))).toBe(0);
  });

  it('only new adjustment or removal settings count as slow work', () => {
    const art = figureOnGreen();
    const settings = { adjust: { ...DEFAULT_ADJUST, saturation: 20 }, removal: DEFAULT_REMOVAL, strokes: [] as BrushStroke[] };
    expect(needsHeavyWork(art, settings)).toBe(true);
    processArt(art, settings);
    expect(needsHeavyWork(art, settings)).toBe(false);
    expect(needsHeavyWork(art, { ...settings, strokes: [{ id: 'x', mode: 'erase', radius: 0.1, softness: 0, points: [0.5, 0.5, 1] }] })).toBe(false);
    expect(needsHeavyWork(art, { ...settings, adjust: { ...DEFAULT_ADJUST, saturation: 21 } })).toBe(true);
  });

  it('the editor can fade the frame and show the brushed-away art faintly; exports never do', () => {
    const d = { ...createDocument(), art: { ...createDocument().art, strokes: [{ id: 'e', mode: 'erase' as const, radius: 0.5, softness: 0, points: [0.5, 0.5, 1] }] } };
    const art = solid('#ff0000');
    const normal = draw(d, art);
    const editing = draw(d, art, undefined, { frameAlpha: 0.5, ghostArt: 0.3 });
    const bandX = 128 - 128 * (1 - 0.17);
    expect(editing.at(bandX, 128)).not.toEqual(normal.at(bandX, 128));
    expect(normal.at(128, 128)[0]).toBeLessThan(60); // erased: the dark backing shows
    expect(editing.at(128, 128)[0]).toBeGreaterThan(normal.at(128, 128)[0] + 40); // the ghost shows through
  });
});

function readPixels(src: RenderSource): Uint8ClampedArray {
  const c = createCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(src.image as unknown as Parameters<typeof ctx.drawImage>[0], 0, 0, src.width, src.height);
  return ctx.getImageData(0, 0, src.width, src.height).data as unknown as Uint8ClampedArray;
}
