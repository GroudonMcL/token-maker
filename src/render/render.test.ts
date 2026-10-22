// @vitest-environment node
// Pixel-level checks of the renderer, drawn with @napi-rs/canvas.
import { createCanvas } from '@napi-rs/canvas';
import { createDocument } from '../document/defaults';
import { outputSize } from '../document/sizing';
import type { TokenDocument } from '../document/types';
import { FRAME_PRESETS, SHAPES } from './catalog';
import type { Ctx } from './frameKit';
import { DEFAULT_ADJUST, DEFAULT_REMOVAL } from '../document/defaults';
import { setCanvasFactory } from '../image/processedArt';
import { renderToken, type RenderSource } from './render';
import { sampleArt } from './sampleArt';

const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;
setCanvasFactory(make);

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

  describe('processed art (Phase 3)', () => {
    // A green figure on a flat white background.
    function figure(): RenderSource {
      const c = make(200, 200);
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 200, 200);
      ctx.fillStyle = '#3c8c32';
      ctx.fillRect(70, 40, 60, 140);
      return { image: c, width: 200, height: 200 };
    }
    const plain = () => doc({ frame: { ...createDocument().frame, style: 'none', presetId: 'none', backingColor: '#ff00ff' } });
    const withArt = (d: TokenDocument, art: Partial<TokenDocument['art']>) => ({ ...d, art: { ...d.art, ...art } });

    it('draws the adjusted picture', () => {
      const out = draw(withArt(plain(), { adjust: { ...DEFAULT_ADJUST, invert: true } }), figure());
      const [r, g, b] = out.at(out.size / 2, out.size / 2);
      expect([r, g, b]).toEqual([0xff - 0x3c, 0xff - 0x8c, 0xff - 0x32]);
    });

    it('shows the backing where the background was removed, and keeps the figure', () => {
      const out = draw(withArt(plain(), { removal: { ...DEFAULT_REMOVAL, enabled: true, softness: 0 } }), figure());
      const c = out.size / 2;
      expect(out.at(c, c).slice(0, 3)).toEqual([0x3c, 0x8c, 0x32]);
      expect(out.at(c - out.size * 0.3, c).slice(0, 3)).toEqual([255, 0, 255]); // backing, not white
    });

    it('an erase stroke shows the backing; restoring it brings the picture back', () => {
      const erase = { mode: 'erase' as const, size: 0.2, softness: 0, points: [0.5, 0.5, 1] };
      const erased = draw(withArt(plain(), { strokes: [erase] }), figure());
      const c = erased.size / 2;
      expect(erased.at(c, c).slice(0, 3)).toEqual([255, 0, 255]);
      const restored = draw(withArt(plain(), { strokes: [erase, { ...erase, mode: 'restore' }] }), figure());
      expect(restored.at(c, c).slice(0, 3)).toEqual([0x3c, 0x8c, 0x32]);
    });

    it('the mask moves with the art', () => {
      const d = withArt(plain(), { removal: { ...DEFAULT_REMOVAL, enabled: true, softness: 0 } });
      const moved = { ...d, art: { ...d.art, transform: { ...d.art.transform, offsetX: 0.5, lockFill: false } } };
      const out = draw(moved, figure());
      const c = out.size / 2;
      // The figure is now right of centre; the centre shows the backing.
      expect(out.at(c, c).slice(0, 3)).toEqual([255, 0, 255]);
      expect(out.at(c + out.size / 4, c).slice(0, 3)).toEqual([0x3c, 0x8c, 0x32]);
    });
  });
});

describe('frame fade while brushing', () => {
  it('draws the frame see-through only when asked (never in exports)', () => {
    const d = createDocument();
    const normal = draw(d, solid('#ff0000'));
    const faded = draw(d, solid('#ff0000'), undefined, { frameAlpha: 0.5 });
    const bandX = 128 - 128 * (1 - 0.17);
    expect(faded.at(bandX, 128)).not.toEqual(normal.at(bandX, 128));
    expect(faded.at(128, 128)).toEqual(normal.at(128, 128)); // the art itself is unchanged
  });
});
