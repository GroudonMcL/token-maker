// @vitest-environment node
// Pixel tests for Phase 4: every background type, every overlay effect (the
// Foreground section until v8), every blend mode, and the light's direction
// on the background.
import { createCanvas } from '@napi-rs/canvas';
import { createDocument, DEFAULT_LIGHTING, newEffect } from '../document/defaults';
import type { BackgroundLayer, BlendMode, EffectKind, EffectLayer, TokenDocument } from '../document/types';
import { setCanvasFactory } from '../image/processedArt';
import type { Ctx } from './frameKit';
import { renderToken, type RenderSource } from './render';

const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;
setCanvasFactory(make);

const SIZE = 200;
/** Points inside the frame's opening: middle, top, bottom, left, right. */
const MID = [100, 100] as const;
const TOP = [100, 50] as const;
const BOTTOM = [100, 150] as const;
const LEFT = [50, 100] as const;
const RIGHT = [150, 100] as const;
type Px = readonly [number, number, number, number];
const lum = (p: Px) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];

function picture(fill: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 100, h = 100): RenderSource {
  const c = make(w, h);
  fill(c.getContext('2d')!, w, h);
  return { image: c, width: w, height: h };
}
const flat = (color: string) => picture((ctx, w, h) => ((ctx.fillStyle = color), ctx.fillRect(0, 0, w, h)));
/** Left half red, right half blue. */
const split = picture((ctx, w, h) => {
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, w / 2, h);
  ctx.fillStyle = '#0000ff';
  ctx.fillRect(w / 2, 0, w / 2, h);
});

/** A token with no frame, shadow or art, so only the layers under test show. */
function bare(patch: Partial<TokenDocument> = {}): TokenDocument {
  const d = createDocument();
  return {
    ...d,
    frame: { ...d.frame, style: 'none', backingOpacity: 0, outerSpacing: 0 },
    shadows: { ...d.shadows, outer: { ...d.shadows.outer, enabled: false }, inner: { ...d.shadows.inner, enabled: false } },
    ...patch,
  };
}

function draw(doc: TokenDocument, assets: [string, RenderSource][] = []) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  renderToken(ctx as unknown as Ctx, doc, new Map(assets), SIZE);
  const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
  return ([x, y]: readonly [number, number]): Px => {
    const i = (y * SIZE + x) * 4;
    return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
  };
}

const bg = (patch: Partial<BackgroundLayer>) => bare({ background: { ...createDocument().background, ...patch } });

describe('backgrounds', () => {
  it('none leaves the opening see-through', () => {
    expect(draw(bare())(MID)[3]).toBe(0);
  });

  it('colour fills the opening, at its opacity, and nothing outside it', () => {
    const at = draw(bg({ kind: 'color', color: '#336699' }));
    expect(at(MID)).toEqual([0x33, 0x66, 0x99, 255]);
    expect(at([2, 2])[3]).toBe(0); // the corner is outside a round token
    const half = draw(bg({ kind: 'color', color: '#336699', opacity: 0.5 }));
    expect(half(MID)[3]).toBeGreaterThan(110);
    expect(half(MID)[3]).toBeLessThan(145);
  });

  it('a linear gradient runs towards its angle; a radial one spreads from the middle', () => {
    const stops = [
      { offset: 0, color: '#000000', opacity: 1 },
      { offset: 1, color: '#ffffff', opacity: 1 },
    ];
    const down = draw(bg({ kind: 'gradient', gradient: { type: 'linear', angle: 90, stops } }));
    expect(lum(down(BOTTOM))).toBeGreaterThan(lum(down(TOP)) + 80);
    const right = draw(bg({ kind: 'gradient', gradient: { type: 'linear', angle: 0, stops } }));
    expect(lum(right(RIGHT))).toBeGreaterThan(lum(right(LEFT)) + 80);
    const radial = draw(bg({ kind: 'gradient', gradient: { type: 'radial', angle: 0, stops } }));
    expect(lum(radial(TOP))).toBeGreaterThan(lum(radial(MID)) + 60);
  });

  it('gradient stops keep their own opacity', () => {
    const at = draw(
      bg({
        kind: 'gradient',
        gradient: { type: 'linear', angle: 90, stops: [{ offset: 0, color: '#ff0000', opacity: 0 }, { offset: 1, color: '#ff0000', opacity: 1 }] },
      }),
    );
    expect(at(TOP)[3]).toBeLessThan(at(BOTTOM)[3] - 80);
  });

  it('a built-in picture, your own picture, and the token art', () => {
    const lib = draw(bg({ kind: 'image', image: { type: 'library', id: 'forest' } }), [['library:forest', flat('#228833')]]);
    expect(lib(MID)).toEqual([0x22, 0x88, 0x33, 255]);
    const own = draw(bg({ kind: 'image', image: { type: 'asset', assetId: 'asset:bg' } }), [['asset:bg', flat('#884422')]]);
    expect(own(MID)).toEqual([0x88, 0x44, 0x22, 255]);
    const d = bg({ kind: 'image', image: { type: 'art' } });
    const art = draw({ ...d, art: { ...d.art, assetId: 'asset:art' } }, [['asset:art', flat('#aa00aa')]]);
    expect(art(MID).slice(0, 3)).toEqual([0xaa, 0x00, 0xaa]);
  });

  it('a missing picture just leaves the background out', () => {
    expect(draw(bg({ kind: 'image', image: { type: 'library', id: 'forest' } }))(MID)[3]).toBe(0);
  });

  it('the picture moves and zooms on its own; blur softens it', () => {
    const src: [string, RenderSource][] = [['asset:bg', split]];
    const base = { kind: 'image' as const, image: { type: 'asset' as const, assetId: 'asset:bg' } };
    const plain = draw(bg(base), src);
    expect(plain(LEFT)[0]).toBe(255);
    expect(plain(RIGHT)[2]).toBe(255);
    // Moved right by half the token: the red half now covers the middle-right.
    const moved = draw(bg({ ...base, offsetX: 0.5 }), src);
    expect(moved([130, 100])[0]).toBe(255);
    // Zoomed in on the middle: points left of centre are still red, right still blue.
    const zoomed = draw(bg({ ...base, zoom: 3 }), src);
    expect(zoomed([85, 100])[0]).toBe(255);
    expect(zoomed([115, 100])[2]).toBe(255);
    // Blurred: the edge in the middle mixes red and blue.
    const blurred = draw(bg({ ...base, blur: 100 }), src);
    const [r, , b] = blurred(MID);
    expect(r).toBeGreaterThan(60);
    expect(b).toBeGreaterThan(60);
  });

  it('lighting lights the background too (unless turned off), brighter towards the light', () => {
    const base = bg({ kind: 'color', color: '#808080' });
    const lit = (direction: number, background = true) =>
      draw({ ...base, lighting: { ...DEFAULT_LIGHTING, enabled: true, direction, color: '#ffffff', strength: 80, falloff: 80, background } });
    const below = lit(90);
    expect(lum(below(BOTTOM))).toBeGreaterThan(lum(below(TOP)) + 40);
    const left = lit(180);
    expect(lum(left(LEFT))).toBeGreaterThan(lum(left(RIGHT)) + 40);
    const off = lit(90, false);
    expect(off(TOP)).toEqual(off(BOTTOM));
  });
});

describe('overlay effects (the Foreground section until v8)', () => {
  const grey = bg({ kind: 'color', color: '#808080' });
  const overlay = (o: Partial<EffectLayer> & { kind: EffectKind }, id = 'o'): EffectLayer => ({ ...newEffect(o.kind, id), placement: 'over', ...o });
  const withOverlay = (o: Partial<EffectLayer> & { kind: EffectKind }) => draw({ ...grey, effects: [overlay(o)] });
  const changed = (a: Px, b: Px) => a.some((v, i) => Math.abs(v - b[i]!) > 6);
  const plain = draw(grey);

  it.each(['gradient', 'vignette', 'foliage', 'cobwebs', 'edgeShadow'] as const)('%s changes the picture somewhere, the same every time', (kind) => {
    const a = withOverlay({ kind, intensity: 100, blend: 'normal' });
    const b = withOverlay({ kind, intensity: 100, blend: 'normal' });
    let differs = 0;
    for (let y = 30; y < 170; y += 10) {
      for (let x = 30; x < 170; x += 10) {
        expect(a([x, y])).toEqual(b([x, y]));
        if (changed(a([x, y]), plain([x, y]))) differs++;
      }
    }
    expect(differs).toBeGreaterThan(3);
  });

  it('a vignette darkens the edge, not the middle', () => {
    const at = withOverlay({ kind: 'vignette', color: '#000000', spread: 40, softness: 30, blend: 'normal', intensity: 100 });
    expect(at(MID)).toEqual(plain(MID));
    expect(lum(at([100, 12]))).toBeLessThan(lum(plain([100, 12])) - 40);
  });

  it('an edge shadow sits on the side it faces', () => {
    const below = withOverlay({ kind: 'edgeShadow', angle: 90, spread: 40, blend: 'normal', intensity: 100 });
    expect(lum(below(BOTTOM))).toBeLessThan(lum(below(TOP)) - 30);
    const above = withOverlay({ kind: 'edgeShadow', angle: 270, spread: 40, blend: 'normal', intensity: 100 });
    expect(lum(above(TOP))).toBeLessThan(lum(above(BOTTOM)) - 30);
  });

  it('overlays stay inside the opening and hidden ones are skipped', () => {
    const at = withOverlay({ kind: 'edgeShadow', angle: 90, spread: 100, blend: 'normal', intensity: 100 });
    expect(at([2, 198])[3]).toBe(0);
    const hidden = withOverlay({ kind: 'edgeShadow', angle: 90, spread: 100, visible: false });
    expect(hidden(BOTTOM)).toEqual(plain(BOTTOM));
  });

  it('intensity scales the effect', () => {
    const full = withOverlay({ kind: 'edgeShadow', angle: 90, spread: 60, softness: 0, blend: 'normal', intensity: 100 });
    const half = withOverlay({ kind: 'edgeShadow', angle: 90, spread: 60, softness: 0, blend: 'normal', intensity: 50 });
    expect(lum(half(BOTTOM))).toBeGreaterThan(lum(full(BOTTOM)) + 20);
    expect(lum(half(BOTTOM))).toBeLessThan(lum(plain(BOTTOM)) - 20);
  });

  it('each blend mode mixes a mid-grey overlay differently with the grey below', () => {
    // A full-strength flat orange layer (a gradient with one colour) over grey.
    const orange = { type: 'linear' as const, angle: 0, stops: [{ offset: 0, color: '#ff8000', opacity: 1 }, { offset: 1, color: '#ff8000', opacity: 1 }] };
    const results = new Map<BlendMode, Px>();
    for (const blend of ['normal', 'multiply', 'screen', 'overlay', 'soft-light'] as const) {
      results.set(blend, withOverlay({ kind: 'gradient', gradient: orange, blend, intensity: 100 })(MID));
    }
    expect(results.get('normal')!.slice(0, 3)).toEqual([255, 128, 0]);
    // Multiply darkens, screen lightens, relative to normal.
    expect(lum(results.get('multiply')!)).toBeLessThan(lum(results.get('normal')!));
    expect(lum(results.get('screen')!)).toBeGreaterThan(lum(results.get('multiply')!));
    expect(results.get('screen')![2]).toBeGreaterThan(100); // grey shows through blue
    // All five differ from each other.
    const all = [...results.values()].map((p) => p.join());
    expect(new Set(all).size).toBe(5);
  });

  it('a blend mode also works on drawn effects', () => {
    const fire = (blend: BlendMode) => draw({ ...grey, effects: [overlay({ kind: 'mist', blend, intensity: 100, spread: 100 })] })(BOTTOM);
    expect(fire('multiply').join()).not.toBe(fire('normal').join());
  });

  it('later overlays are drawn on top of earlier ones', () => {
    const red = { type: 'linear' as const, angle: 0, stops: [{ offset: 0, color: '#ff0000', opacity: 1 }, { offset: 1, color: '#ff0000', opacity: 1 }] };
    const blue = { ...red, stops: red.stops.map((s) => ({ ...s, color: '#0000ff' })) };
    const order = (first: EffectLayer, second: EffectLayer) => draw({ ...grey, effects: [first, second] })(MID);
    const redThenBlue = order(overlay({ kind: 'gradient', gradient: red, blend: 'normal', intensity: 100 }, 'a'), overlay({ kind: 'gradient', gradient: blue, blend: 'normal', intensity: 100 }, 'b'));
    expect(redThenBlue.slice(0, 3)).toEqual([0, 0, 255]);
  });

  it('blur softens an effect without moving it', () => {
    const sharp = withOverlay({ kind: 'edgeShadow', angle: 90, spread: 50, softness: 0, blend: 'normal', intensity: 100 });
    const soft = withOverlay({ kind: 'edgeShadow', angle: 90, spread: 50, softness: 0, blend: 'normal', intensity: 100, blur: 0.2 });
    // Further from the shadow's edge it stays dark; across the edge the change is gentler.
    expect(Math.abs(lum(soft([100, 175])) - lum(sharp([100, 175])))).toBeLessThan(30);
    let sharpJump = 0;
    let softJump = 0;
    for (let y = 60; y < 170; y += 2) {
      sharpJump = Math.max(sharpJump, Math.abs(lum(sharp([100, y + 2])) - lum(sharp([100, y]))));
      softJump = Math.max(softJump, Math.abs(lum(soft([100, y + 2])) - lum(soft([100, y]))));
    }
    expect(softJump).toBeLessThan(sharpJump);
  });
});
