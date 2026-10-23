// @vitest-environment node
// Pixel tests for Phase 6 (DESIGN.md §6.8): every effect in every placement
// draws something and draws it the same way every time for a given seed;
// placements land in the right layer; list order is respected; sizes are per
// grid square; and dragging Intensity reuses the drawn layers.
import { createCanvas } from '@napi-rs/canvas';
import { createDocument, EFFECTS, newEffect, newPictureEffect } from '../document/defaults';
import type { EffectKind, EffectLayer, EffectPlacement, TokenDocument } from '../document/types';
import { setCanvasFactory } from '../image/processedArt';
import { PAINTERS } from './effectPainters';
import { clearEffectCache, drawEffect, type EffectArea } from './effects';
import type { Ctx } from './frameKit';
import { renderToken, type RenderSource } from './render';
import { pictureAssetId } from './pictureLibrary';
import { cutOutArt } from './sampleArt';

const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;
setCanvasFactory(make);

const SIZE = 160;
const PLACEMENTS: EffectPlacement[] = ['behind', 'over', 'border'];
type Px = readonly [number, number, number, number];

const flat = (color: string): RenderSource => {
  const c = make(100, 100);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 100, 100);
  return { image: c, width: 100, height: 100 };
};

/** A picture effect's sprite: a white four-pointed star on nothing, like the built-in ones. */
const SPRITE = { type: 'library', id: 'fx-twinkles' } as const;
const sprite = ((): RenderSource => {
  const c = make(64, 64);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const r = i % 2 ? 8 : 31;
    ctx.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  ctx.fill();
  return { image: c, width: 64, height: 64 };
})();

function token(effects: Partial<EffectLayer>[], patch: Partial<TokenDocument> = {}): TokenDocument {
  const d = createDocument();
  return {
    ...d,
    art: { ...d.art, assetId: 'asset:art' },
    background: { ...d.background, kind: 'color', color: '#41566e' },
    effects: effects.map((e, i) => ({ ...(e.kind === 'picture' ? newPictureEffect(SPRITE, `fx${i}`) : newEffect(e.kind ?? 'fire', `fx${i}`)), ...e })),
    ...patch,
  };
}

function draw(doc: TokenDocument, art: RenderSource = cutOutArt(make, 120), size = SIZE): Uint8ClampedArray {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  renderToken(ctx as unknown as Ctx, doc, new Map([['asset:art', art], [pictureAssetId(SPRITE), sprite]]), size);
  return ctx.getImageData(0, 0, size, size).data;
}

const at = (data: Uint8ClampedArray, x: number, y: number, size = SIZE): Px => {
  const i = (Math.round(y) * size + Math.round(x)) * 4;
  return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
};

/** How many pixels differ by more than a little. */
function changed(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!) + Math.abs(a[i + 3]! - b[i + 3]!) > 12) n++;
  }
  return n;
}

const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Effects with a random layout (the glows, flat tints and smooth overlays have none). */
const RANDOM: EffectKind[] = EFFECTS.map((e) => e.kind).filter((k) => !['innerGlow', 'outerGlow', 'unconscious', 'vignette', 'gradient', 'edgeShadow'].includes(k));

describe('every effect', () => {
  const plain = draw(token([]));

  describe.each(PLACEMENTS)('placed %s', (placement) => {
    it.each(EFFECTS.map((e) => e.kind))('%s draws something, the same way every time', (kind) => {
      const doc = token([{ kind, placement }]);
      clearEffectCache();
      const first = draw(doc);
      clearEffectCache(); // really draw it again, not from the cache
      const second = draw(doc);
      expect(same(first, second)).toBe(true);
      expect(changed(plain, first), `${kind} ${placement} changed nothing`).toBeGreaterThan(20);
    });
  });

  it.each(RANDOM)('%s: Shuffle (another seed) gives another layout', (kind) => {
    const a = draw(token([{ kind, seed: 1 }]));
    const b = draw(token([{ kind, seed: 2 }]));
    expect(changed(a, b)).toBeGreaterThan(10);
    expect(same(a, draw(token([{ kind, seed: 1 }])))).toBe(true);
  });

  it('effects take a time, so animation can be added later (time 0 is what is drawn today)', () => {
    const area: EffectArea = { shape: 'circle', R: 80, unit: 80, opening: 20, bandOuter: 8, bandInner: 20 };
    const frame = (kind: EffectKind, time: number) => {
      const c = createCanvas(SIZE, SIZE);
      const ctx = c.getContext('2d') as unknown as Ctx;
      ctx.translate(80, 80);
      drawEffect(ctx, { ...newEffect(kind, 'fx'), placement: 'over' }, area, SIZE, null, time);
      return (ctx as unknown as CanvasRenderingContext2D).getImageData(0, 0, SIZE, SIZE).data;
    };
    for (const kind of ['fire', 'embers', 'lightning'] as const) {
      expect(same(frame(kind, 0), frame(kind, 0))).toBe(true);
      expect(changed(frame(kind, 0), frame(kind, 0.5)), kind).toBeGreaterThan(10);
    }
  });

  it('nothing is drawn outside the square, even when drawn into a bigger canvas', () => {
    const canvas = createCanvas(SIZE + 40, SIZE + 40);
    const ctx = canvas.getContext('2d');
    ctx.translate(20, 20);
    const doc = token([{ kind: 'fire', size: 0.5, spread: 100 }, { kind: 'outerGlow', size: 0.5 }, { kind: 'mist', placement: 'border', size: 0.5 }]);
    renderToken(ctx as unknown as Ctx, doc, new Map([['asset:art', cutOutArt(make, 120)]]), SIZE);
    const data = ctx.getImageData(0, 0, SIZE + 40, SIZE + 40).data;
    for (let y = 0; y < SIZE + 40; y++) {
      for (let x = 0; x < SIZE + 40; x++) {
        if (x >= 20 && x < SIZE + 20 && y >= 20 && y < SIZE + 20) continue;
        expect(data[(y * (SIZE + 40) + x) * 4 + 3]).toBe(0);
      }
    }
  });

  it('Intensity 0 or hidden draws nothing; Intensity scales the effect', () => {
    const plainFlat = draw(token([]), flat('#808080'));
    expect(same(draw(token([{ kind: 'innerGlow', intensity: 0 }]), flat('#808080')), plainFlat)).toBe(true);
    expect(same(draw(token([{ kind: 'innerGlow', visible: false }]), flat('#808080')), plainFlat)).toBe(true);
    // An inner red glow just inside the frame's opening, at the top.
    const edge = (intensity: number) => at(draw(token([{ kind: 'innerGlow', color: '#ff0000', intensity }]), flat('#808080')), 80, 23)[0];
    expect(edge(30)).toBeGreaterThan(edge(0) + 10);
    expect(edge(100)).toBeGreaterThan(edge(30) + 10);
  });
});

describe('placement', () => {
  // A plain grey picture covering the whole opening, so "behind" is hidden.
  const grey = flat('#808080');
  const red = { kind: 'innerGlow' as const, color: '#ff0000', size: 0.3, spread: 100 };
  const MID_EDGE: [number, number] = [80, 30]; // inside the opening, near the top
  const FRAME: [number, number] = [80, 13]; // on the frame band

  it('behind the art is hidden by an opaque picture, but shows where the art is see-through', () => {
    expect(same(draw(token([{ ...red, placement: 'behind' }]), grey), draw(token([]), grey))).toBe(true);
    const cut = draw(token([{ ...red, placement: 'behind' }]));
    const p = at(cut, ...MID_EDGE);
    expect(p[0]).toBeGreaterThan(p[2] + 40); // the background there turned red
  });

  it('over the art covers the picture, but not the frame', () => {
    const doc = token([{ ...red, placement: 'over' }]);
    const p = at(draw(doc, grey), ...MID_EDGE);
    expect(p[0]).toBeGreaterThan(p[1] + 60);
    expect(at(draw(doc, grey), ...FRAME)).toEqual(at(draw(token([]), grey), ...FRAME));
  });

  it('on the border is drawn over the frame, not over the middle of the art', () => {
    const doc = token([{ ...red, placement: 'border' }]);
    const plain = draw(token([]), grey);
    const fx = draw(doc, grey);
    expect(at(fx, ...FRAME)).not.toEqual(at(plain, ...FRAME));
    expect(at(fx, 80, 80)).toEqual(at(plain, 80, 80));
  });

  it('a border effect is drawn over the frame, which is drawn over an "over the art" effect', () => {
    // A solid band of blue over the art reaching under the frame: the frame still covers it.
    const under = draw(token([{ kind: 'innerGlow', color: '#0000ff', size: 0.5, spread: 100, placement: 'over' }]), grey);
    expect(at(under, ...FRAME)).toEqual(at(draw(token([]), grey), ...FRAME));
  });

  it('effects with the same placement are drawn in list order (the end of the list on top)', () => {
    const solid = { kind: 'innerGlow' as const, size: 0.4, spread: 100, placement: 'over' as const };
    const redOnTop = at(draw(token([{ ...solid, color: '#0000ff' }, { ...solid, color: '#ff0000' }]), grey), ...MID_EDGE);
    const blueOnTop = at(draw(token([{ ...solid, color: '#ff0000' }, { ...solid, color: '#0000ff' }]), grey), ...MID_EDGE);
    expect(redOnTop[0]).toBeGreaterThan(redOnTop[2] + 60);
    expect(blueOnTop[2]).toBeGreaterThan(blueOnTop[0] + 60);
  });

  it('the condition looks change what is under them', () => {
    const red = flat('#cc2222');
    const petrified = at(draw(token([{ kind: 'petrified', spread: 0 }]), red), 80, 90);
    expect(Math.abs(petrified[0] - petrified[1])).toBeLessThan(40); // red turned stone grey
    const ethereal = at(draw(token([{ kind: 'ethereal' }]), red), 80, 120);
    expect(ethereal[3]).toBeLessThan(200); // see-through
  });
});

describe('sizes are per grid square', () => {
  it('an outer glow reaches as far on the map on a Large token as on a Medium one', () => {
    const glow = { kind: 'outerGlow' as const, color: '#ffffff', size: 0.2, spread: 0 };
    // Same pixels per square: Medium at 160 px, Large (2 squares) at 320 px.
    const medium = draw(token([glow]), flat('#808080'), 160);
    const large = draw(token([glow], { size: { preset: 'large', squares: 2 } }), flat('#808080'), 320);
    for (const d of [3, 6, 9]) {
      const m = at(medium, 80, d, 160)[3];
      const l = at(large, 160, d, 320)[3];
      expect(Math.abs(m - l), `${d} px from the edge`).toBeLessThan(25);
    }
  });
});

describe('performance', () => {
  it('dragging Intensity reuses the drawn layers instead of redrawing the effect', () => {
    clearEffectCache();
    const original = PAINTERS.frost;
    let paints = 0;
    let passes = 0;
    PAINTERS.frost = (s) => {
      const list = original(s);
      passes = list.length;
      return list.map((p) => ({ ...p, paint: (ctx: Ctx) => (paints++, p.paint(ctx)) }));
    };
    try {
      for (const intensity of [100, 80, 60, 40, 20]) draw(token([{ kind: 'frost', intensity }]));
    } finally {
      PAINTERS.frost = original;
    }
    expect(passes).toBeGreaterThan(0);
    expect(paints).toBe(passes); // each pass drawn once, then reused
  });

  it('three stacked effects add little to a phone-sized preview once drawn', () => {
    const doc = token([{ kind: 'frost' }, { kind: 'mist' }, { kind: 'bloodied' }]);
    const size = 720; // a phone's preview: ~280 CSS px at 2.6× pixel ratio
    const art = cutOutArt(make, 400);
    const time = (d: TokenDocument) => {
      draw(d, art, size);
      const t0 = performance.now();
      for (let i = 0; i < 5; i++) draw({ ...d, effects: d.effects.map((e) => ({ ...e, intensity: 50 + i * 10 })) }, art, size);
      return (performance.now() - t0) / 5;
    };
    const plain = time(token([]));
    const stacked = time(doc);
    expect(stacked).toBeLessThan(plain * 2 + 30);
  });
});
