// @vitest-environment node
// Decorations and picture frames (DESIGN.md §6.9): snapping and mirroring
// maths, and pixel checks of layers 1, 9 and 11 drawn with @napi-rs/canvas.
import { createCanvas } from '@napi-rs/canvas';
import { createDocument, DECORATIONS, newDecoration, newPictureDecoration } from '../document/defaults';
import type { Decoration, ImageFrame, TokenDocument } from '../document/types';
import { circleHole } from '../image/frameHole';
import { setCanvasFactory } from '../image/processedArt';
import { decorationCorners, decorationGeometry, mirrorPlacement, nearestSnap, placements, rayToPolygon, SNAP_POINTS, snapPosition } from './decorations';
import type { Ctx } from './frameKit';
import { imageClipPolygon } from './geometry';
import { frameAssetId } from './imageFrames';
import { pictureAssetId } from './pictureLibrary';
import { renderToken, type RenderSource } from './render';
import { shapePolygon } from './shapes';

const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;
setCanvasFactory(make);

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

function solid(color: string, w = 200, h = 200): RenderSource {
  const c = make(w, h);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return { image: c, width: w, height: h };
}

function draw(doc: TokenDocument, assets: [string, RenderSource][] = [], size = 256) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  renderToken(ctx as unknown as Ctx, doc, new Map(assets), size);
  const data = ctx.getImageData(0, 0, size, size).data;
  return {
    data,
    at: (x: number, y: number) => {
      const i = (Math.round(y) * size + Math.round(x)) * 4;
      return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!] as const;
    },
  };
}

const plain = (patch: Partial<TokenDocument> = {}) => {
  const d = { ...createDocument(), ...patch };
  d.shadows = { ...d.shadows, outer: { ...d.shadows.outer, enabled: false } };
  return d;
};

describe('decoration snapping and mirroring', () => {
  const geo = decorationGeometry(createDocument());

  it('puts snap points on the middle of the frame band, facing outwards', () => {
    const insets = { outer: 0.1, inner: 0.24 }; // the default Stamped frame, per square on a Medium token
    const mid = 1 - (insets.outer + insets.inner) / 2;
    const top = snapPosition('top', geo);
    expect(top.x).toBeCloseTo(0, 6);
    expect(top.y).toBeCloseTo(-mid, 2);
    expect(top.facing).toBe(0); // pictures are drawn for the top
    expect(snapPosition('right', geo)).toMatchObject({ facing: 90 });
    expect(snapPosition('bottom', geo).facing).toBe(180);
    expect(snapPosition('topLeft', geo).facing).toBe(-45);
    const tr = snapPosition('topRight', geo);
    expect(tr.x).toBeCloseTo(mid * Math.SQRT1_2, 2);
    expect(tr.y).toBeCloseTo(-mid * Math.SQRT1_2, 2);
  });

  it('follows the shape: a square token’s corners are further out', () => {
    const square = decorationGeometry({ ...createDocument(), shape: 'square' });
    const c = snapPosition('bottomRight', square);
    const s = snapPosition('bottom', square);
    expect(Math.hypot(c.x, c.y)).toBeCloseTo(Math.hypot(s.x, s.y) * Math.SQRT2, 2);
  });

  it('a mirrored copy is the reflection across the middle line', () => {
    const p = { x: 0.4, y: -0.6, rotation: 30, flip: false, mirrored: false };
    expect(mirrorPlacement(p)).toEqual({ x: -0.4, y: -0.6, rotation: -30, flip: true, mirrored: true });
    // Mirroring twice gives the original back.
    const back = mirrorPlacement(mirrorPlacement(p));
    expect(back).toMatchObject({ x: 0.4, y: -0.6, flip: false });
    expect(close(back.rotation, 30)).toBe(true);
  });

  it('mirrored snap points land on the matching snap point on the other side', () => {
    const pairs: [Decoration['place'], Decoration['place']][] = [
      ['topRight', 'topLeft'],
      ['right', 'left'],
      ['bottomRight', 'bottomLeft'],
    ];
    for (const [a, b] of pairs) {
      const [one, two] = placements({ ...newDecoration('horn'), place: a, rotation: 10, mirror: true }, geo);
      const other = placements({ ...newDecoration('horn'), place: b, rotation: -10, flip: true }, geo)[0]!;
      expect(two!.x).toBeCloseTo(other.x, 6);
      expect(two!.y).toBeCloseTo(other.y, 6);
      expect(two!.rotation).toBeCloseTo(other.rotation, 6);
      expect(two!.flip).toBe(true);
      expect(one!.mirrored).toBe(false);
    }
  });

  it('does not double a mirrored decoration sitting on the middle line facing straight out', () => {
    expect(placements({ ...newDecoration('gem'), place: 'top', mirror: true }, geo)).toHaveLength(1);
    expect(placements({ ...newDecoration('gem'), place: 'top', mirror: true, rotation: 20 }, geo)).toHaveLength(2);
    expect(placements({ ...newDecoration('gem'), place: 'free', x: 0.3, y: 0, mirror: true }, geo)).toHaveLength(2);
  });

  it('snaps to the nearest snap point only when close', () => {
    for (const s of SNAP_POINTS) {
      const p = snapPosition(s, geo);
      expect(nearestSnap({ x: p.x + 0.05, y: p.y - 0.04 }, geo)).toBe(s);
    }
    expect(nearestSnap({ x: 0, y: 0 }, geo)).toBeNull();
    expect(nearestSnap({ x: 0.2, y: -0.2 }, geo)).toBeNull();
  });

  it('sizes are per grid square: a Large token’s decorations are the same size on the map', () => {
    const d = newDecoration('gem');
    const medium = decorationCorners(d, { x: 0, y: 0, rotation: 0, flip: false, mirrored: false }, 1);
    const large = decorationCorners(d, { x: 0, y: 0, rotation: 0, flip: false, mirrored: false }, 2);
    const height = (c: { y: number }[]) => c[3]!.y - c[0]!.y;
    expect(height(large)).toBeCloseTo(height(medium) / 2, 6); // half the token, so the same on the map
  });

  it('the picture box turns with the decoration around its anchor', () => {
    const d = { ...newDecoration('horn'), size: 0.5 };
    const up = decorationCorners(d, { x: 0, y: 0, rotation: 0, flip: false, mirrored: false }, 1);
    const turned = decorationCorners(d, { x: 0, y: 0, rotation: 90, flip: false, mirrored: false }, 1);
    // A quarter turn clockwise: (x, y) → (−y, x).
    up.forEach((p, i) => {
      expect(turned[i]!.x).toBeCloseTo(-p.y, 6);
      expect(turned[i]!.y).toBeCloseTo(p.x, 6);
    });
  });

  it('measures rays to a polygon', () => {
    const circle = shapePolygon('circle', 1, 0.2);
    for (const deg of [0, 33, 90, 200]) expect(rayToPolygon(circle, deg)).toBeCloseTo(0.8, 3);
  });
});

/** A picture decoration's picture: a white disc with a dark ring, twice as wide as it is tall. */
const PICTURE = { type: 'library', id: 'deco-heart' } as const;
const picture = ((): RenderSource => {
  const c = make(80, 40);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(0, 0, 80, 40);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(4, 4, 72, 32);
  return { image: c, width: 80, height: 40 };
})();

describe('decorations in the renderer', () => {
  it.each(DECORATIONS.filter((d) => d.kind !== 'picture').map((d) => [d.name, d.kind] as const))('%s draws at its snap point, the same every time', (_name, kind) => {
    const doc = plain({ decorations: [{ ...newDecoration(kind, 'd'), place: 'free', x: 0, y: 0, mirror: false, size: 0.6 }] });
    const a = draw(doc);
    const b = draw(doc);
    expect(Buffer.compare(Buffer.from(a.data), Buffer.from(b.data))).toBe(0);
    const empty = draw(plain());
    // Something new was drawn round the middle.
    let changed = 0;
    for (let y = 98; y < 158; y += 2) for (let x = 98; x < 158; x += 2) if (a.at(x, y).join() !== empty.at(x, y).join()) changed++;
    expect(changed).toBeGreaterThan(20);
  });

  it('a picture decoration draws its picture at its own shape, coloured in (dark parts stay dark) or as it is (v8)', () => {
    const deco = { ...newPictureDecoration(PICTURE, 2, '#ff0000', 'p'), place: 'free' as const, x: 0, y: 0, size: 0.5 };
    const withPic = (d: Partial<Decoration>) => draw(plain({ decorations: [{ ...deco, ...d }] }), [[pictureAssetId(PICTURE), picture]]);
    const tinted = withPic({});
    // 256 px token = 1 square; size 0.5 = a quarter of a square high (64 px), twice as wide.
    expect(tinted.at(128, 128).slice(0, 3)).toEqual([255, 0, 0]);
    expect(tinted.at(128 + 55, 128).slice(0, 3)).toEqual([255, 0, 0]);
    expect(tinted.at(128, 128 + 30)).not.toEqual(tinted.at(128, 128));
    const own = withPic({ tint: false });
    expect(own.at(128, 128).slice(0, 3)).toEqual([255, 255, 255]);
    // Not loaded yet: nothing drawn rather than something wrong.
    const missing = draw(plain({ decorations: [deco] }));
    expect(missing.at(128, 128)).toEqual(draw(plain()).at(128, 128));
    expect(decorationCorners(deco, { x: 0, y: 0, rotation: 0, flip: false, mirrored: false }, 1).map((p) => Math.round(p.x * 100) / 100)).toEqual([-0.5, 0.5, 0.5, -0.5]);
  });

  it('mirroring draws a matching copy on the other side; hiding and opacity work', () => {
    const star = { ...newDecoration('star', 's'), place: 'right' as const, mirror: false, color: '#ff0000', size: 0.4 };
    const one = draw(plain({ decorations: [star] }));
    const both = draw(plain({ decorations: [{ ...star, mirror: true }] }));
    const r = snapPosition('right', decorationGeometry(createDocument()));
    const px = (x: number) => 128 + x * 128;
    expect(one.at(px(r.x), 128)[0]).toBeGreaterThan(150); // the red star on the right
    expect(one.at(px(-r.x), 128)[0]).toBeLessThan(150); // nothing on the left yet
    expect(both.at(px(-r.x), 128)[0]).toBeGreaterThan(150);
    expect(draw(plain({ decorations: [{ ...star, visible: false }] })).at(px(r.x), 128)).toEqual(draw(plain()).at(px(r.x), 128));
    const faint = draw(plain({ decorations: [{ ...star, opacity: 0.3 }] }));
    expect(faint.at(px(r.x), 128)[0]).toBeLessThan(one.at(px(r.x), 128)[0]);
  });

  it('draws over the frame and stays inside the square', () => {
    const horn = { ...newDecoration('horn', 'h'), place: 'top' as const, mirror: false, size: 3 };
    const img = draw(plain({ decorations: [horn] }), [], 128);
    let outside = 0;
    const c = createCanvas(160, 160);
    const ctx = c.getContext('2d');
    ctx.translate(16, 16);
    renderToken(ctx as unknown as Ctx, plain({ decorations: [horn] }), new Map(), 128);
    const d = ctx.getImageData(0, 0, 160, 160).data;
    for (let y = 0; y < 160; y++) for (let x = 0; x < 160; x++) if ((x < 16 || y < 16 || x >= 144 || y >= 144) && d[(y * 160 + x) * 4 + 3]! > 0) outside++;
    expect(outside).toBe(0);
    expect(img.at(64, 6)[3]).toBeGreaterThan(0); // the horn covers the top of the frame
  });

  it('decorations join the outer drop shadow’s silhouette', () => {
    // A gem sticking out above the frame, its shadow falling to the right.
    const gem = { ...newDecoration('roundGem', 'g'), place: 'free' as const, x: 0, y: -0.97, size: 0.3, mirror: false };
    const base = createDocument();
    base.shadows.outer = { ...base.shadows.outer, followLight: false, angle: 0, distance: 0.12, blur: 0, opacity: 1 };
    const withGem = draw({ ...base, decorations: [gem] });
    const without = draw(base);
    const at = [128 + 0.2 * 128, 128 - 0.97 * 128] as const; // right of the gem, outside the frame
    expect(without.at(...at)[3]).toBe(0);
    expect(withGem.at(...at)[3]).toBeGreaterThan(150);
  });
});

describe('picture frames in the renderer', () => {
  /** A gold ring picture: solid between 0.75 and 0.95 of the half-size, see-through elsewhere. */
  function ringPicture(size = 200): RenderSource {
    const c = make(size, size);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#d4a020';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.475, 0, Math.PI * 2);
    ctx.arc(size / 2, size / 2, size * 0.375, 0, Math.PI * 2, true);
    ctx.fill();
    return { image: c, width: size, height: size };
  }
  const image = (patch: Partial<ImageFrame> = {}): ImageFrame => ({
    source: { type: 'upload', id: 'ring' },
    name: 'Ring',
    hole: circleHole(0.76),
    outer: 0.95,
    nudge: { x: 0, y: 0, scale: 1 },
    ...patch,
  });
  const framed = (patch: Partial<ImageFrame> = {}, size: TokenDocument['size'] = { preset: 'medium', squares: 1 }) => {
    const d = plain({ size });
    d.frame = { ...d.frame, kind: 'image', image: image(patch) };
    d.art.assetId = 'asset:a';
    return d;
  };
  const assets: [string, RenderSource][] = [
    ['asset:a', solid('#ff0000')],
    [frameAssetId({ type: 'upload', id: 'ring' }), ringPicture()],
  ];

  it('clips the art to the hole and draws the picture over it', () => {
    const img = draw(framed(), assets);
    expect(img.at(128, 128)).toEqual([255, 0, 0, 255]); // art in the hole
    const band = img.at(128, 128 - 0.85 * 128);
    expect(band[3]).toBe(255);
    expect(band.slice(0, 3)).not.toEqual([255, 0, 0]); // the ring, not the art
    expect(img.at(128 - 0.85 * 128, 128)[0]).toBeGreaterThan(150); // gold
    expect(img.at(2, 2)[3]).toBe(0); // outside the ring stays see-through
  });

  it('uses the hole as the art’s clipping shape everywhere (geometry too)', () => {
    const d = framed({ nudge: { x: 0.1, y: 0, scale: 0.5 } });
    const clip = imageClipPolygon(d);
    const xs = clip.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(0.1 - 0.38, 2);
    expect(Math.max(...xs)).toBeCloseTo(0.1 + 0.38, 2);
    const img = draw(d, assets);
    expect(img.at(128 + 0.1 * 128, 128)).toEqual([255, 0, 0, 255]);
    // Outside the smaller hole the backing shows, not the art.
    expect(img.at(128 - 0.6 * 128, 128).slice(0, 3)).not.toEqual([255, 0, 0]);
  });

  it('scales with the token: on a Large token the ring is the same fraction of it', () => {
    const medium = draw(framed(), assets, 256);
    const large = draw(framed({}, { preset: 'large', squares: 2 }), assets, 256);
    expect(large.at(128, 128 - 0.85 * 128)).toEqual(medium.at(128, 128 - 0.85 * 128));
  });

  it('draws nothing for the frame while its picture is still loading, but keeps the hole', () => {
    const img = draw(framed(), [assets[0]!]);
    expect(img.at(128, 128)).toEqual([255, 0, 0, 255]);
    expect(img.at(128, 128 - 0.85 * 128)[0]).not.toBe(255);
  });

  it('casts the drop shadow from the picture’s outline', () => {
    const d = framed();
    d.shadows.outer = { ...d.shadows.outer, enabled: true, followLight: false, angle: 90, distance: 0.1, blur: 0, opacity: 1 };
    const img = draw(d, assets);
    // Just below the ring at the bottom: shadow; just above the ring at the top: nothing.
    expect(img.at(128, 128 + 0.95 * 128 + 4)[3]).toBeGreaterThan(100);
    expect(img.at(128, 128 - 0.95 * 128 - 4)[3]).toBe(0);
  });
});
