// @vitest-environment node
// Phase 5 pixel tests (DESIGN.md §6.6, §6.7): pop-out art and shadows.
import { createCanvas } from '@napi-rs/canvas';
import { createDocument } from '../document/defaults';
import type { ArtTransform, PopOutStroke, TokenDocument } from '../document/types';
import { setCanvasFactory } from '../image/processedArt';
import type { Ctx } from './frameKit';
import { baseScale, imageClipPolygon, imagePointAt, tokenPointAt } from './geometry';
import { renderToken, type RenderSource } from './render';
import type { Point } from './shapes';

const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;
setCanvasFactory(make);

const SIZE = 256;
const R = SIZE / 2;

/** A smooth blue-green picture, so any seam or misplaced pixel shows. */
function gradientArt(): RenderSource {
  const c = make(200, 200);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(200, 200);
  for (let y = 0; y < 200; y++) {
    for (let x = 0; x < 200; x++) {
      const i = (y * 200 + x) * 4;
      img.data[i] = 20;
      img.data[i + 1] = 40 + x;
      img.data[i + 2] = 60 + y;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { image: c, width: 200, height: 200 };
}
const ART = gradientArt();

function tokenDoc(transform: Partial<ArtTransform>, strokes: PopOutStroke[], patch: (d: TokenDocument) => void = () => {}): TokenDocument {
  const d = createDocument();
  d.art.assetId = 'asset:a';
  d.art.transform = { ...d.art.transform, ...transform };
  d.art.popOut = { enabled: true, strokes };
  patch(d);
  return d;
}

function draw(doc: TokenDocument, canvasSize = SIZE, offset = 0) {
  const canvas = createCanvas(canvasSize, canvasSize);
  const ctx = canvas.getContext('2d');
  ctx.translate(offset, offset);
  renderToken(ctx as unknown as Ctx, doc, new Map([['asset:a', ART]]), SIZE);
  const data = ctx.getImageData(0, 0, canvasSize, canvasSize).data;
  const at = (x: number, y: number) => {
    const i = (Math.round(y) * canvasSize + Math.round(x)) * 4;
    return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
  };
  return { data, at };
}

/** The art drawn alone with the document's transform, unclipped: what pop-out parts must look like. */
function reference(doc: TokenDocument) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  const t = doc.art.transform;
  const s = baseScale(ART.width, ART.height, imageClipPolygon(doc)) * t.zoom * R;
  ctx.translate(R, R);
  ctx.translate(t.offsetX * R, t.offsetY * R);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale(t.flipX ? -s : s, t.flipY ? -s : s);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(ART.image as unknown as Parameters<typeof ctx.drawImage>[0], -ART.width / 2, -ART.height / 2, ART.width, ART.height);
  const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
  return (x: number, y: number) => {
    const i = (Math.round(y) * SIZE + Math.round(x)) * 4;
    return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
  };
}

const px = (p: Point) => ({ x: R + p.x * R, y: R + p.y * R });
const diff = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));
const dab = (q: Point, size: number): PopOutStroke => ({ mode: 'add', size, softness: 0, points: [q.x, q.y, 1] });
/** The picture point drawn at token point `p` for this document. */
const pictureAt = (doc: TokenDocument, p: Point) => imagePointAt(doc.art.transform, ART.width, ART.height, imageClipPolygon(doc), p);

describe('pop-out art', () => {
  it('has no seam: across the frame it is the same pixels as the inside art', () => {
    // The top 45 % of the picture pops out; the art is zoomed so it runs over the border.
    const strip: PopOutStroke = { mode: 'add', size: 0.5, softness: 0, points: [-0.2, 0.2, 1, 1.2, 0.2, 1] };
    const doc = tokenDoc({ zoom: 1.5 }, [strip]);
    const img = draw(doc);
    const ref = reference(doc);
    // A column through the top of the token, from the outer spacing, over the
    // frame and the clip edge, down into the art.
    let worst = 0;
    for (let y = 0; y <= 100; y++) for (let x = 100; x <= 156; x += 4) worst = Math.max(worst, diff(img.at(x, y), ref(x, y)));
    expect(worst).toBe(0);
    // Without the pop-out the frame is there instead.
    const plain = draw(tokenDoc({ zoom: 1.5 }, []));
    expect(diff(plain.at(128, 18), ref(128, 18))).toBeGreaterThan(30);
  });

  it('draws nothing over the border when switched off, and keeps the mask', () => {
    const doc = tokenDoc({ zoom: 1.5 }, [dab({ x: 0.5, y: 0.1 }, 0.3)]);
    doc.art.popOut.enabled = false;
    const off = draw(doc);
    const none = draw(tokenDoc({ zoom: 1.5 }, []));
    expect(Buffer.compare(Buffer.from(off.data), Buffer.from(none.data))).toBe(0);
  });

  it('stays on the same part of the art when the art is moved, rotated and flipped', () => {
    const before = tokenDoc({ zoom: 1.5 }, []);
    const spot = { x: 0, y: -0.85 }; // on the frame at the top
    const q = pictureAt(before, spot);
    const strokes = [dab(q, 0.08)];

    const a = tokenDoc({ zoom: 1.5 }, strokes);
    const imgA = draw(a);
    expect(diff(imgA.at(px(spot).x, px(spot).y), reference(a)(px(spot).x, px(spot).y))).toBeLessThanOrEqual(2);

    // Turn the art a quarter, flip it and nudge it: the painted spot goes with it.
    const b = tokenDoc({ zoom: 1.5, rotation: 90, flipY: true, offsetX: 0.02, offsetY: 0.03 }, strokes);
    const moved = tokenPointAt(b.art.transform, ART.width, ART.height, imageClipPolygon(b), q);
    expect(Math.hypot(moved.x + 0.85, moved.y)).toBeLessThan(0.1); // now on the left of the frame
    const imgB = draw(b);
    const m = px(moved);
    expect(diff(imgB.at(m.x, m.y), reference(b)(m.x, m.y))).toBeLessThanOrEqual(2);
    // …and the old place shows the frame again.
    expect(diff(imgB.at(px(spot).x, px(spot).y), reference(b)(px(spot).x, px(spot).y))).toBeGreaterThan(30);
  });

  it('never draws outside the square, even when drawn into a bigger canvas', () => {
    const doc = tokenDoc({ zoom: 3 }, [{ mode: 'add', size: 3, softness: 0, points: [0.5, 0.5, 1] }], (d) => {
      d.shadows.outer = { ...d.shadows.outer, distance: 0.5, blur: 0.5, opacity: 1 };
    });
    const pad = 22;
    const img = draw(doc, SIZE + pad * 2, pad);
    let outside = 0;
    for (let y = 0; y < SIZE + pad * 2; y++) {
      for (let x = 0; x < SIZE + pad * 2; x++) {
        const inside = x >= pad && x < pad + SIZE && y >= pad && y < pad + SIZE;
        if (!inside && img.at(x, y)[3]! > 0) outside++;
      }
    }
    expect(outside).toBe(0);
    // The pop-out reaches the very corners of the square.
    expect(img.at(pad + 1, pad + 1)[3]).toBe(255);
    expect(img.at(pad + SIZE - 2, pad + SIZE - 2)[3]).toBe(255);
  });
});

describe('shadows (Phase 5)', () => {
  /** A small pop-out spot on the top of the frame, with a strong, sharp pop-out shadow. */
  const spotDoc = (lightFrom: number, shadowOn = true) => {
    const base = tokenDoc({ zoom: 1.5 }, []);
    return tokenDoc({ zoom: 1.5 }, [dab(pictureAt(base, { x: 0, y: -0.83 }), 0.1)], (d) => {
      d.lighting.direction = lightFrom;
      d.shadows.popOut = { ...d.shadows.popOut, enabled: shadowOn, distance: 0.1, blur: 0.02, opacity: 1 };
    });
  };
  const lumAt = (img: ReturnType<typeof draw>, p: Point) => {
    const [r, g, b] = img.at(px(p).x, px(p).y);
    return 0.299 * r! + 0.587 * g! + 0.114 * b!;
  };
  const left = { x: -0.17, y: -0.8 };
  const right = { x: 0.17, y: -0.8 };

  it('the pop-out shadow falls on the frame, away from the light', () => {
    const noShadow = draw(spotDoc(180, false));
    const fromLeft = draw(spotDoc(180));
    const fromRight = draw(spotDoc(0));
    // Light from the left: the frame to the right of the spot is darker; the left is untouched.
    expect(lumAt(fromLeft, right)).toBeLessThan(lumAt(noShadow, right) - 20);
    expect(Math.abs(lumAt(fromLeft, left) - lumAt(noShadow, left))).toBeLessThan(3);
    // Light from the right: the other way round.
    expect(lumAt(fromRight, left)).toBeLessThan(lumAt(noShadow, left) - 20);
    expect(Math.abs(lumAt(fromRight, right) - lumAt(noShadow, right))).toBeLessThan(3);
  });

  it('unlinked shadows use their own angle, whatever the light', () => {
    const doc = spotDoc(180);
    doc.shadows.popOut = { ...doc.shadows.popOut, followLight: false, angle: 180 }; // falls to the left
    const img = draw(doc);
    const noShadow = draw(spotDoc(180, false));
    expect(lumAt(img, left)).toBeLessThan(lumAt(noShadow, left) - 20);
    expect(Math.abs(lumAt(img, right) - lumAt(noShadow, right))).toBeLessThan(3);
  });

  it('the outer drop shadow falls away from the light', () => {
    const shadowAt = (lightFrom: number, p: Point) => {
      const d = createDocument();
      d.lighting.direction = lightFrom;
      return draw(d).at(px(p).x, px(p).y)[3]!;
    };
    const below = { x: 0, y: 0.96 };
    const above = { x: 0, y: -0.96 };
    expect(shadowAt(270, below)).toBeGreaterThan(shadowAt(270, above) + 30); // light from above
    expect(shadowAt(90, above)).toBeGreaterThan(shadowAt(90, below) + 30); // light from below
  });

  it('the outer drop shadow includes pop-out parts', () => {
    const base = tokenDoc({ zoom: 1.5 }, []);
    const parts = [dab(pictureAt(base, { x: 0, y: 0.9 }), 0.05)]; // sticks out over the bottom edge
    const make = (enabled: boolean) =>
      tokenDoc({ zoom: 1.5 }, parts, (d) => {
        d.art.popOut.enabled = enabled;
        d.lighting.direction = 270; // from above: the shadow falls down
        d.shadows.outer = { ...d.shadows.outer, distance: 0.06, blur: 0.02, opacity: 1 };
      });
    const probe = px({ x: 0, y: 0.99 });
    expect(draw(make(true)).at(probe.x, probe.y)[3]!).toBeGreaterThan(draw(make(false)).at(probe.x, probe.y)[3]! + 40);
  });
});
