// The before/after pictures for every help tip outside the Image and
// Effects sections (Phase 10), drawn with the real renderer. Each picture is
// named after its help id ("frame.thickness" → frame-thickness.webp).
// Called by scripts/help-images.ts (npm run help-images).
import { createCanvas, GlobalFonts, loadImage, type Canvas, type Image } from '@napi-rs/canvas';
import { existsSync, readFileSync } from 'node:fs';
import { createDocument, DEFAULT_REMOVAL, LIGHT_PRESETS, newDecoration, newEffect, newLabel, newOverlay, RING_TEXT_STYLE } from '../src/document/defaults';
import type { Decoration, LabelSettings, LightPresetId, OverlayLayer, PopOutStroke, TokenDocument } from '../src/document/types';
import { findFrameHole } from '../src/image/frameHole';
import { framePresetById } from '../src/render/catalog';
import type { Ctx } from '../src/render/frameKit';
import { frameAssetId } from '../src/render/imageFrames';
import { renderToken, type RenderSource } from '../src/render/render';
import { BUILT_IN_PRESETS } from '../src/presets/builtins';
import { LOOK_KEYS } from '../src/presets/preset';

type Save = (name: string, before: Canvas, after: Canvas) => void;
type Change = (d: TokenDocument) => void;

const T = 240;
const BACKDROP = '#2a251f';

const source = (img: Image | Canvas): RenderSource => ({ image: img as unknown as CanvasImageSource, width: img.width, height: img.height });
const assets = new Map<string, RenderSource>();

/** The flat-background goblin, cut out, on a slate background: the starting token for most pictures. */
function base(): TokenDocument {
  const doc = createDocument('Goblin');
  doc.art.assetId = 'asset:goblin';
  doc.art.removal = { ...DEFAULT_REMOVAL, enabled: true };
  doc.art.transform = { ...doc.art.transform, zoom: 0.95, offsetY: 0.08 };
  doc.background = { ...doc.background, kind: 'color', color: '#41566e' };
  return doc;
}

/** The goblin zoomed so its ears reach over the frame, with the pop-out painted over them. */
const EARS: PopOutStroke[] = [
  { mode: 'add', size: 0.11, softness: 0.2, points: [0.13, 0.25, 1, 0.24, 0.31, 1, 0.34, 0.36, 1] },
  { mode: 'add', size: 0.11, softness: 0.2, points: [0.87, 0.25, 1, 0.76, 0.31, 1, 0.66, 0.36, 1] },
];
const zoomed: Change = (d) => {
  d.art.transform = { ...d.art.transform, zoom: 1.75, offsetY: 0.45 };
};
const popOut = (strokes = EARS): Change => (d) => {
  zoomed(d);
  d.art.popOut = { enabled: true, strokes };
};

const with_ = (...changes: (Change | undefined)[]): TokenDocument => {
  const d = base();
  for (const c of changes) c?.(d);
  return d;
};

function checker(ctx: ReturnType<Canvas['getContext']>, w: number, h: number) {
  for (let y = 0; y < h; y += 12) {
    for (let x = 0; x < w; x += 12) {
      ctx.fillStyle = (x + y) % 24 ? '#cfcfcf' : '#f2f2f2';
      ctx.fillRect(x, y, 12, 12);
    }
  }
}

/** A VTT-like map: grass with grid lines, `cells` squares across. */
function mapGrid(ctx: ReturnType<Canvas['getContext']>, cells: number) {
  ctx.fillStyle = '#5f7a48';
  ctx.fillRect(0, 0, T, T);
  ctx.strokeStyle = 'rgba(20, 30, 15, 0.45)';
  ctx.lineWidth = 1;
  const step = T / cells;
  for (let i = 1; i < cells; i++) {
    ctx.beginPath();
    ctx.moveTo(i * step + 0.5, 0);
    ctx.lineTo(i * step + 0.5, T);
    ctx.moveTo(0, i * step + 0.5);
    ctx.lineTo(T, i * step + 0.5);
    ctx.stroke();
  }
}

type Backdrop = 'dark' | 'light' | 'checker' | 'map';

function tokenCanvas(doc: TokenDocument, size = T): Canvas {
  const c = createCanvas(size, size);
  renderToken(c.getContext('2d') as unknown as Ctx, doc, assets, size);
  return c;
}

/** One half of a picture: the token on a backdrop. */
function tok(doc: TokenDocument | null, backdrop: Backdrop = 'dark'): Canvas {
  const c = createCanvas(T, T);
  const ctx = c.getContext('2d');
  if (backdrop === 'checker') checker(ctx, T, T);
  else if (backdrop === 'map') mapGrid(ctx, 4);
  else {
    ctx.fillStyle = backdrop === 'light' ? '#d9d0c0' : BACKDROP;
    ctx.fillRect(0, 0, T, T);
  }
  if (doc) ctx.drawImage(tokenCanvas(doc), 0, 0);
  return c;
}

/** Several tokens side by side on a backdrop (batch, size and export pictures). */
function group(items: { doc: TokenDocument; x: number; y: number; size: number }[], backdrop: Backdrop | { map: number } = 'dark'): Canvas {
  const c = createCanvas(T, T);
  const ctx = c.getContext('2d');
  if (typeof backdrop === 'object') mapGrid(ctx, backdrop.map);
  else {
    ctx.fillStyle = backdrop === 'light' ? '#d9d0c0' : BACKDROP;
    ctx.fillRect(0, 0, T, T);
  }
  for (const it of items) ctx.drawImage(tokenCanvas(it.doc, Math.round(it.size)), it.x, it.y);
  return c;
}

const pair = (save: Save, id: string, before: TokenDocument, after: TokenDocument, backdrop: Backdrop = 'dark') =>
  save(id.replace('.', '-'), tok(before, backdrop), tok(after, backdrop));

const overlay = (kind: OverlayLayer['kind'], patch: Partial<OverlayLayer> = {}): Change => (d) => {
  d.foreground = [...d.foreground, { ...newOverlay(kind, `${kind}${d.foreground.length}`), ...patch }];
};
const bg = (patch: Partial<TokenDocument['background']>): Change => (d) => {
  d.background = { ...d.background, ...patch };
};
const forest = (patch: Partial<TokenDocument['background']> = {}) => bg({ kind: 'image', image: { type: 'library', id: 'forest' }, ...patch });
const light = (id: LightPresetId | null, patch: Partial<TokenDocument['lighting']> = {}): Change => (d) => {
  const p = id ? LIGHT_PRESETS.find((x) => x.id === id)!.settings : {};
  d.lighting = { ...d.lighting, ...p, enabled: true, preset: id, ...patch, rim: { ...d.lighting.rim, ...(p as { rim?: object }).rim, ...patch.rim } };
};
const shadow = (key: 'outer' | 'popOut', patch: Partial<TokenDocument['shadows']['outer']>): Change => (d) => {
  d.shadows = { ...d.shadows, [key]: { ...d.shadows[key], ...patch } };
};
const inner = (patch: Partial<TokenDocument['shadows']['inner']>): Change => (d) => {
  d.shadows = { ...d.shadows, inner: { ...d.shadows.inner, ...patch } };
};
const deco = (kind: Decoration['kind'], patch: Partial<Decoration> = {}): Change => (d) => {
  d.decorations = [...d.decorations, { ...newDecoration(kind, `${kind}${d.decorations.length}`), ...patch }];
};
const label = (patch: Partial<LabelSettings> = {}): Change => (d) => {
  d.label = { ...newLabel(), ...patch };
};
const ring = (patch: Partial<LabelSettings> = {}) => label({ shape: 'ring', ...RING_TEXT_STYLE, ...patch });
const frame = (patch: Partial<TokenDocument['frame']>): Change => (d) => {
  d.frame = { ...d.frame, ...patch };
};
const framePreset = (id: string, patch: Partial<TokenDocument['frame']> = {}): Change => {
  const p = framePresetById(id)!;
  return frame({ kind: 'code', presetId: p.id, style: p.style, color: p.color, highlightColor: null, ...patch });
};
const transform = (patch: Partial<TokenDocument['art']['transform']>): Change => (d) => {
  d.art.transform = { ...d.art.transform, ...patch };
};
const named = (name: string): Change => (d) => {
  d.name = name;
};
const preset = (name: string): Change => (d) => {
  const p = BUILT_IN_PRESETS.find((x) => x.name === name)!;
  const look = structuredClone(p.look) as Record<string, unknown>;
  for (const k of LOOK_KEYS) (d as unknown as Record<string, unknown>)[k] = look[k];
  d.art.assetId = d.art.assetId ?? 'asset:goblin';
};
/** The other test picture: the goblin on a sky, no background removal. */
const boss: Change = (d) => {
  d.art.assetId = 'asset:boss';
  d.art.removal = { ...DEFAULT_REMOVAL };
  d.art.transform = { ...d.art.transform, zoom: 1, offsetY: 0.1 };
};
const imageFrame = (id: string, nudge = { x: 0, y: 0, scale: 1 }): Change => (d) => {
  const f = frames.get(id)!;
  d.frame = { ...d.frame, kind: 'image', image: { source: f.source, name: id, hole: f.hole, outer: f.outer, nudge } };
};

const frames = new Map<string, { source: { type: 'library' | 'upload'; id: string }; hole: number[]; outer: number }>();

async function addFrame(id: string, file: string, type: 'library' | 'upload') {
  const img = await loadImage(readFileSync(file));
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  const small = createCanvas(512, 512);
  small.getContext('2d').drawImage(c, 0, 0, 512, 512);
  const found = findFrameHole(small.getContext('2d').getImageData(0, 0, 512, 512));
  const src = { type, id };
  assets.set(frameAssetId(src), source(c));
  frames.set(id, { source: src, hole: found.hole, outer: found.outer });
}

/** Text in the site's own UI font (for the file-name picture). */
function registerUiFont() {
  for (const w of ['400', '700']) {
    const f = `node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-${w}-normal.woff2`;
    if (existsSync(f)) GlobalFonts.register(readFileSync(f), 'Atkinson Hyperlegible');
  }
}

function fileCard(doc: TokenDocument, fileName: string, bad: boolean): Canvas {
  const c = createCanvas(T, T);
  const ctx = c.getContext('2d');
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, T, T);
  ctx.drawImage(tokenCanvas(doc, 150), 45, 14);
  ctx.fillStyle = bad ? '#e07a6a' : '#f1e9dc';
  ctx.font = 'bold 19px "Atkinson Hyperlegible"';
  ctx.textAlign = 'center';
  ctx.fillText(fileName, T / 2, 200, T - 16);
  return c;
}

/** A token saved as a JPG of the given quality, read back in (for the Quality picture). */
async function jpeg(doc: TokenDocument, quality: number): Promise<Canvas> {
  const c = tok(doc, 'light');
  const img = await loadImage(c.toBuffer('image/jpeg', quality));
  const out = createCanvas(T, T);
  out.getContext('2d').drawImage(img, 0, 0);
  return out;
}

/** The token drawn at a small size and blown back up, like a low-resolution export. */
function lowRes(doc: TokenDocument, px: number): Canvas {
  const small = tokenCanvas(doc, px);
  const c = createCanvas(T, T);
  const ctx = c.getContext('2d');
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, T, T);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, T, T);
  return c;
}

/**
 * The goblin with pop-out strokes tinted teal, as the editor shows them while
 * painting (only over the goblin, not its flat white background).
 */
function tealArt(goblin: Image, strokes: readonly PopOutStroke[]): Canvas {
  const w = goblin.width;
  const h = goblin.height;
  const tint = createCanvas(w, h);
  const t = tint.getContext('2d');
  const side = Math.max(w, h);
  t.lineCap = 'round';
  t.lineJoin = 'round';
  for (const s of strokes) {
    t.globalCompositeOperation = s.mode === 'add' ? 'source-over' : 'destination-out';
    t.strokeStyle = 'rgb(40, 210, 200)';
    t.lineWidth = s.size * side * (1 - s.softness * 0.4);
    t.shadowColor = 'rgb(40, 210, 200)';
    t.shadowBlur = s.softness * s.size * side * 0.5;
    t.beginPath();
    for (let i = 0; i < s.points.length; i += 3) {
      const x = s.points[i]! * w;
      const y = s.points[i + 1]! * h;
      if (i === 0) t.moveTo(x, y);
      else t.lineTo(x, y);
    }
    if (s.points.length === 3) t.lineTo(s.points[0]! * w + 0.1, s.points[1]! * h);
    t.stroke();
  }
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.drawImage(goblin, 0, 0);
  const art = ctx.getImageData(0, 0, w, h);
  const tinted = t.getImageData(0, 0, w, h);
  for (let i = 0; i < art.data.length; i += 4) {
    const white = art.data[i]! > 235 && art.data[i + 1]! > 235 && art.data[i + 2]! > 235;
    const a = white ? 0 : (tinted.data[i + 3]! / 255) * 0.55;
    for (let k = 0; k < 3; k++) art.data[i + k] = art.data[i + k]! * (1 - a) + tinted.data[i + k]! * a;
  }
  ctx.putImageData(art, 0, 0);
  return c;
}

let goblinImage: Image;
let tealCount = 0;
/** Pop-out painted with these strokes, with the teal mask showing. */
const showMask = (strokes = EARS): Change => (d) => {
  const id = `asset:teal${tealCount++}`;
  assets.set(id, source(tealArt(goblinImage, strokes)));
  popOut(strokes)(d);
  d.art.assetId = id;
};

export async function tokenPictures(save: Save): Promise<void> {
  registerUiFont();
  const goblin = await loadImage('e2e/fixtures/flat-goblin.png');
  const bossImg = await loadImage('e2e/fixtures/goblin-boss.png');
  assets.set('asset:goblin', source(goblin));
  assets.set('asset:boss', source(bossImg));
  goblinImage = goblin;
  for (const id of ['forest', 'night-sky', 'tavern', 'dungeon']) assets.set(`library:${id}`, source(await loadImage(readFileSync(`public/backgrounds/${id}.webp`))));
  for (const id of ['gilded-laurel', 'rope', 'dragon-scales']) await addFrame(id, `public/frames/${id}.webp`, 'library');
  await addFrame('ring', 'e2e/fixtures/purple-ring.png', 'upload');
  // null: the empty token you start with, before any picture is imported.
  const empty = () => with_((d) => (d.art.assetId = null), bg({ kind: 'none' }));
  const p = (id: string, before: (Change | undefined)[] | null, after: (Change | undefined)[] | null, backdrop: Backdrop = 'dark') =>
    pair(save, id, before ? with_(...before) : empty(), after ? with_(...after) : empty(), backdrop);

  // ---- Sections ----
  p('section.import', null, []);
  p('section.image', [boss], [boss, (d) => (d.art.adjust = { ...d.art.adjust, contrast: 25, saturation: 25, temperature: 25 })]);
  p('section.background', [bg({ kind: 'none' })], [forest()]);
  p('section.foreground', [], [overlay('mist'), overlay('vignette')]);
  p('section.lighting', [], [light('torchlight')]);
  p('section.popout', [zoomed], [popOut()]);
  p('section.effects', [], [(d) => (d.effects = [newEffect('fire', 'f'), newEffect('embers', 'e')])]);
  p('section.frame', [], [framePreset('wizard'), (d) => (d.shape = 'hexagon')]);
  p('section.decorations', [], [deco('horn'), deco('gem', { place: 'bottom' })]);
  p('section.label', [], [label()]);
  p('section.presets', [], [preset('Boss')]);
  save('section-size', group([{ doc: with_(), x: 60, y: 60, size: 60 }], { map: 4 }), group([{ doc: with_((d) => (d.size = { preset: 'large', squares: 2 })), x: 60, y: 60, size: 120 }], { map: 4 }));
  save('section-export', tok(with_()), group([{ doc: with_(), x: 60, y: 60, size: 60 }], { map: 4 }));

  // ---- Import ----
  p('import.upload', null, []);
  p('import.web', null, [boss]);
  {
    const strip = createCanvas(T, T);
    const ctx = strip.getContext('2d');
    ctx.fillStyle = BACKDROP;
    ctx.fillRect(0, 0, T, T);
    const thumbs: Image[] = [bossImg, goblin, bossImg];
    thumbs.forEach((img, i) => {
      const x = 12 + i * 76;
      ctx.drawImage(img, x, 70, 66, 88);
      if (i === 1) {
        ctx.strokeStyle = '#d6a24e';
        ctx.lineWidth = 4;
        ctx.strokeRect(x - 2, 68, 70, 92);
      }
    });
    save('import-pagePictures', strip, tok(with_()));
  }
  p('import.name', [label(), named('Untitled token')], [label(), named('Goblin Scout')]);

  // ---- Background ----
  p('background.kind', [bg({ kind: 'none' })], [bg({ kind: 'gradient' })]);
  p('background.color', [], [bg({ color: '#8a3b3b' })]);
  const grad = (stops: [number, string][], angle = 90, type: 'linear' | 'radial' = 'linear') =>
    bg({ kind: 'gradient', gradient: { type, angle, stops: stops.map(([offset, color]) => ({ offset, color, opacity: 1 })) } });
  p('background.gradientType', [grad([[0, '#ffc070'], [1, '#2a1a40']])], [grad([[0, '#ffc070'], [1, '#2a1a40']], 90, 'radial')]);
  p('background.gradientAngle', [grad([[0, '#e0a050'], [1, '#2a1a40']], 90)], [grad([[0, '#e0a050'], [1, '#2a1a40']], 0)]);
  p('background.gradientColors', [bg({ kind: 'gradient' })], [grad([[0, '#ff9a3c'], [1, '#5a1f6e']])]);
  p('background.gradientStops', [grad([[0, '#ff9a3c'], [1, '#5a1f6e']])], [grad([[0, '#ff9a3c'], [0.35, '#ffe08a'], [0.65, '#3c8ac0'], [1, '#5a1f6e']])]);
  p('background.source', [forest()], [boss, bg({ kind: 'image', image: { type: 'art' }, zoom: 1.3, blur: 40 })]);
  p('background.library', [bg({ kind: 'none' })], [bg({ kind: 'image', image: { type: 'library', id: 'night-sky' } })]);
  p('background.upload', [], [bg({ kind: 'image', image: { type: 'library', id: 'tavern' } })]);
  p('background.blur', [forest()], [forest({ blur: 80 })]);
  p('background.zoom', [forest()], [forest({ zoom: 2.5 })]);
  p('background.move', [forest({ zoom: 1.6 })], [forest({ zoom: 1.6, offsetX: 0.45, offsetY: -0.3 })]);
  p('background.opacity', [forest(), frame({ backingColor: '#7a2f2f' })], [forest({ opacity: 0.35 }), frame({ backingColor: '#7a2f2f' })]);

  // ---- Foreground ----
  p('foreground.add', [], [overlay('foliage'), overlay('vignette')]);
  p('foreground.color', [overlay('mist')], [overlay('mist', { color: '#c58bff' })]);
  p('foreground.angle', [overlay('foliage', { angle: 90 })], [overlay('foliage', { angle: 225 })]);
  p('foreground.size', [overlay('vignette', { size: 20 })], [overlay('vignette', { size: 80 })]);
  p('foreground.softness', [overlay('shadow', { softness: 5 })], [overlay('shadow', { softness: 95 })]);
  p('foreground.scale', [overlay('foliage', { scale: 60 })], [overlay('foliage', { scale: 180 })]);
  p('foreground.opacity', [overlay('smoke', { opacity: 0.2 })], [overlay('smoke', { opacity: 0.95 })]);
  const warm = { opacity: 0.8, gradient: { type: 'linear' as const, angle: 90, stops: [{ offset: 0, color: '#ffb050', opacity: 1 }, { offset: 1, color: '#3a1050', opacity: 1 }] } };
  p('foreground.blend', [overlay('gradient', { ...warm, blend: 'normal' })], [overlay('gradient', { ...warm, blend: 'soft-light' })]);
  p('foreground.shuffle', [overlay('cobwebs', { seed: 1 })], [overlay('cobwebs', { seed: 7 })]);

  // ---- Lighting ----
  p('lighting.presets', [], [light('moonlight')]);
  p('lighting.enabled', [], [light(null)]);
  p('lighting.direction', [light('torchlight')], [light('torchlight', { direction: 270 })]);
  p('lighting.color', [light('torchlight')], [light('torchlight', { color: '#76ff4a' })]);
  p('lighting.strength', [light('torchlight', { strength: 15 })], [light('torchlight', { strength: 100 })]);
  p('lighting.falloff', [light('torchlight', { falloff: 0 })], [light('torchlight', { falloff: 95 })]);
  // A pale light from above on a dark background shows the rim best.
  const rimLight = (r: Partial<TokenDocument['lighting']['rim']>) =>
    light('moonlight', { color: '#e6efff', strength: 45, falloff: 45, rim: { enabled: true, strength: 90, width: 40, softness: 20, ...r } });
  const rim = (r: Partial<TokenDocument['lighting']['rim']>): Change => (d) => {
    bg({ color: '#1c2230' })(d);
    rimLight(r)(d);
  };
  p('lighting.rim', [rim({ enabled: false })], [rim({})]);
  p('lighting.rimStrength', [rim({ strength: 15 })], [rim({ strength: 100 })]);
  p('lighting.rimWidth', [rim({ width: 10 })], [rim({ width: 90 })]);
  p('lighting.rimSoftness', [rim({ softness: 0 })], [rim({ softness: 100 })]);
  p('lighting.background', [forest(), light('torchlight', { background: false })], [forest(), light('torchlight', { background: true })]);

  // ---- Shadows (on a light backdrop, so the drop shadow shows) ----
  const L: Backdrop = 'light';
  p('shadows.outer', [shadow('outer', { enabled: false })], [shadow('outer', { distance: 0.08, blur: 0.12 })], L);
  const paleFrame = frame({ color: '#e8d9b0' });
  p('shadows.popOut', [popOut(), paleFrame, shadow('popOut', { enabled: false })], [popOut(), paleFrame, shadow('popOut', { opacity: 1, distance: 0.07, blur: 0.03 })], L);
  const unlinked = (patch: Partial<TokenDocument['shadows']['outer']> = {}) => shadow('outer', { followLight: false, angle: 45, distance: 0.08, blur: 0.12, ...patch });
  p('shadows.follow', [shadow('outer', { distance: 0.08 })], [unlinked({ angle: 160 })], L);
  p('shadows.angle', [unlinked()], [unlinked({ angle: 200 })], L);
  p('shadows.distance', [unlinked({ distance: 0.01 })], [unlinked({ distance: 0.18 })], L);
  p('shadows.blur', [unlinked({ blur: 0.01 })], [unlinked({ blur: 0.3 })], L);
  p('shadows.color', [unlinked()], [unlinked({ color: '#6a1aa0', opacity: 1 })], L);
  p('shadows.opacity', [unlinked({ opacity: 0.25 })], [unlinked({ opacity: 1 })], L);
  p('shadows.inner', [bg({ color: '#c9b48a' }), inner({ enabled: false })], [bg({ color: '#c9b48a' }), inner({ strength: 1, softness: 0.2 })]);
  p('shadows.innerStrength', [bg({ color: '#c9b48a' }), inner({ strength: 0.25 })], [bg({ color: '#c9b48a' }), inner({ strength: 1 })]);
  p('shadows.innerSoftness', [bg({ color: '#c9b48a' }), inner({ strength: 1, softness: 0.03 })], [bg({ color: '#c9b48a' }), inner({ strength: 1, softness: 0.35 })]);

  // ---- Pop-out ----
  p('popout.brush', [zoomed], [popOut()]);
  p('popout.mode', [showMask()], [showMask([...EARS, { mode: 'erase', size: 0.2, softness: 0, points: [0.9, 0.24, 1, 0.72, 0.33, 1] }])]);
  p('popout.size', [showMask(EARS.map((s) => ({ ...s, size: 0.03 })))], [showMask(EARS.map((s) => ({ ...s, size: 0.16 })))]);
  p('popout.show', [popOut()], [showMask()]);
  p('popout.enabled', [popOut(), (d) => (d.art.popOut.enabled = false)], [popOut()]);
  const soft = (softness: number) => showMask(EARS.map((s) => ({ ...s, size: 0.16, softness })));
  p('popout.advanced', [soft(0)], [soft(1)]);
  p('popout.softness', [soft(0)], [soft(1)]);

  // ---- Effects ----
  p('effects.advanced', [(d) => (d.effects = [newEffect('fire', 'f')])], [(d) => (d.effects = [{ ...newEffect('fire', 'f'), color: '#4aa8ff', size: 0.24, spread: 100 }])]);

  // ---- Decorations ----
  p('decorations.add', [], [deco('gem')]);
  p('decorations.place', [deco('gem')], [deco('gem', { place: 'bottomRight' })]);
  p('decorations.mirror', [deco('horn', { mirror: false })], [deco('horn', { mirror: true })]);
  p('decorations.size', [deco('gem', { size: 0.12 })], [deco('gem', { size: 0.34 })]);
  p('decorations.rotation', [deco('sword', { place: 'topRight' })], [deco('sword', { place: 'topRight', rotation: 60 })]);
  p('decorations.color', [deco('gem')], [deco('gem', { color: '#3fbf6a' })]);
  p('decorations.opacity', [deco('crown')], [deco('crown', { opacity: 0.35 })]);
  p('decorations.flip', [deco('sword', { place: 'topRight' })], [deco('sword', { place: 'topRight', flip: true })]);

  // ---- Label ----
  p('label.add', [], [label()]);
  p('label.shape', [label()], [label({ shape: 'plaque' })]);
  p('label.text', [label()], [label({ text: 'Grik' })]);
  p('label.font', [label()], [label({ font: 'pirata-one', bold: false })]);
  p('label.uploadFont', [label()], [label({ font: 'unifrakturmaguntia', bold: false })]);
  p('label.size', [label({ size: 0.13 })], [label({ size: 0.3 })]);
  p('label.color', [label()], [label({ color: '#8a1c1c' })]);
  p('label.style', [label({ bold: false })], [label({ bold: true, italic: true, font: 'spectral' })]);
  const box = (patch: Partial<LabelSettings> = {}) => label({ shape: 'box', width: 1.7, curve: 0, ...patch });
  p('label.align', [box({ text: 'Grik' })], [box({ text: 'Grik', align: 'left' })]);
  p('label.place', [label()], [label({ place: 'top', y: -0.75, curve: -25 })]);
  p('label.angle', [ring()], [ring({ angle: 270, place: 'top' })]);
  const free = (patch: Partial<LabelSettings>) => label({ shape: 'pill', place: 'free', x: 0, y: 0.75, curve: 0, ...patch });
  p('label.x', [free({})], [free({ x: 0.35 })]);
  p('label.y', [free({})], [free({ y: 0.1 })]);
  p('label.arc', [ring({ text: 'Grik the Unbearably Sly', arc: 70 })], [ring({ text: 'Grik the Unbearably Sly', arc: 220 })]);
  p('label.width', [label({ width: 0.9 })], [label({ width: 1.9 })]);
  p('label.curve', [label({ curve: 0 })], [label({ curve: 70 })]);
  p('label.corners', [box()], [box({ corners: 'sharp' })]);
  p('label.fill', [label()], [label({ fill: '#7a1f1f', color: '#f6e7c8' })]);
  p('label.opacity', [label()], [label({ opacity: 0.35 })]);
  p('label.outline', [label({ outline: { width: 0, color: '#5a3d1e' } })], [label({ outline: { width: 0.06, color: '#5a3d1e' } })]);
  p('label.outlineColor', [label({ outline: { width: 0.05, color: '#5a3d1e' } })], [label({ outline: { width: 0.05, color: '#d6a24e' } })]);
  const longName = 'Grimbold the Long-Winded';
  p('label.shrink', [label({ text: longName, shrinkToFit: false })], [label({ text: longName })]);
  const fancy = { letterSpacing: 0.25, textOutline: { width: 0.025, color: '#f6e7c8' }, shadow: { enabled: true, color: '#000000', opacity: 0.8, blur: 0.04 } };
  p('label.advanced', [label()], [label(fancy)]);
  p('label.spacing', [label({ letterSpacing: 0 })], [label({ letterSpacing: 0.35 })]);
  const plainRing = { textOutline: { width: 0, color: '#20140a' }, shadow: { enabled: false, color: '#000000', opacity: 0.7, blur: 0.03 } };
  p('label.textOutline', [forest(), ring(plainRing)], [forest(), ring({ ...plainRing, textOutline: { width: 0.035, color: '#20140a' } })]);
  p('label.textOutlineColor', [ring()], [ring({ textOutline: { width: 0.03, color: '#a01818' } })]);
  const shadowed = (s: Partial<LabelSettings['shadow']>) => ring({ textOutline: { width: 0, color: '#000000' }, shadow: { enabled: true, color: '#000000', opacity: 0.8, blur: 0.03, ...s } });
  p('label.shadow', [ring(plainRing)], [shadowed({})], L);
  p('label.shadowColor', [shadowed({})], [shadowed({ color: '#ff6a00', opacity: 1 })], L);
  p('label.shadowOpacity', [shadowed({ opacity: 0.2 })], [shadowed({ opacity: 1 })], L);
  p('label.shadowBlur', [shadowed({ blur: 0.005 })], [shadowed({ blur: 0.09 })], L);

  // ---- Presets: the look moves from one goblin to another ----
  p('presets.builtIn', [], [preset('Undead')]);
  for (const [id, name] of [['presets.save', 'Fey'], ['presets.yours', 'Fiend'], ['presets.import', 'Celestial']] as const) {
    p(id, [boss, preset(name)], [preset(name)]);
  }

  // ---- Frame & shape ----
  p('frame.shape', [], [(d) => (d.shape = 'hexagon')]);
  p('frame.kind', [], [imageFrame('gilded-laurel')]);
  p('frame.picture', [imageFrame('rope')], [imageFrame('dragon-scales')]);
  p('frame.upload', [], [imageFrame('ring')]);
  p('frame.holeSize', [imageFrame('ring', { x: 0, y: 0, scale: 0.8 })], [imageFrame('ring')]);
  p('frame.holeX', [imageFrame('ring', { x: 0.14, y: 0, scale: 1 })], [imageFrame('ring')]);
  p('frame.holeY', [imageFrame('ring', { x: 0, y: 0.14, scale: 1 })], [imageFrame('ring')]);
  p('frame.holeReset', [imageFrame('ring', { x: 0.1, y: -0.08, scale: 0.85 })], [imageFrame('ring')]);
  p('frame.style', [], [framePreset('druid')]);
  p('frame.color', [], [frame({ color: '#3f6fd8' })]);
  p('frame.thickness', [frame({ thickness: 0.06 })], [frame({ thickness: 0.3 })]);
  p('frame.highlight', [framePreset('monk')], [framePreset('monk', { highlightColor: '#e04040' })]);
  p('frame.outerSpacing', [frame({ outerSpacing: 0 })], [frame({ outerSpacing: 0.3 })], L);
  p('frame.innerSpacing', [frame({ innerSpacing: 0 })], [frame({ innerSpacing: 0.12, backingColor: '#d6a24e' })]);
  p('frame.backingColor', [bg({ kind: 'none' })], [bg({ kind: 'none' }), frame({ backingColor: '#7a2f2f' })]);
  p('frame.backingOpacity', [bg({ kind: 'none' })], [bg({ kind: 'none' }), frame({ backingOpacity: 0 })], 'checker');

  // ---- Size ----
  save('size-preset', group([{ doc: with_(), x: 60, y: 60, size: 60 }], { map: 4 }), group([{ doc: with_((d) => (d.size = { preset: 'huge', squares: 3 })), x: 60, y: 60, size: 180 }], { map: 4 }));
  save('size-custom', group([{ doc: with_((d) => (d.size = { preset: 'large', squares: 2 })), x: 0, y: 0, size: 96 }], { map: 5 }), group([{ doc: with_((d) => (d.size = { preset: 'custom', squares: 2.5 })), x: 0, y: 0, size: 120 }], { map: 5 }));

  // ---- Export ----
  const jpg = (fill: string): Canvas => {
    const c = tok(null, 'checker');
    const ctx = c.getContext('2d');
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, T, T);
    ctx.drawImage(tokenCanvas(with_()), 0, 0);
    return c;
  };
  save('export-format', jpg('#ffffff'), tok(with_(), 'checker'));
  save('export-fill', jpg('#ffffff'), jpg('#4f6f86'));
  save('export-resolution', lowRes(with_(), 48), tok(with_()));
  save('export-customPx', lowRes(with_(), 80), tok(with_()));
  save('export-fileName', fileCard(with_(), 'Grik the Sly?!.png', true), fileCard(with_(), 'Grik-the-Sly.png', false));
  save('export-copy', tok(with_()), group([{ doc: with_(), x: 60, y: 120, size: 60 }], { map: 4 }));
  const batch = (n: number) =>
    [boss, undefined, (d: TokenDocument) => (d.art.transform = { ...d.art.transform, zoom: 1.3, offsetY: 0.3 }), boss].slice(0, n).map((c, i) => ({
      doc: with_(c, framePreset('gilded'), label({ size: 0.24 }), named(['Grik', 'Snag', 'Mox', 'Bree'][i]!)),
      x: (i % 2) * 120 + 6,
      y: Math.floor(i / 2) * 120 + 6,
      size: 108,
    }));
  save('export-all', group(batch(1)), group(batch(4)));
  save('export-advanced', await jpeg(with_(), 92), await jpeg(with_(), 12));
  save('export-quality', await jpeg(with_(), 92), await jpeg(with_(), 12));

  // ---- Batch, canvas, top bar and toolbar ----
  save('batch-strip', group(batch(1)), group(batch(4)));
  save('topbar-batch', group(batch(1)), group(batch(4)));
  p('canvas.stage', [], [transform({ zoom: 1.3, offsetX: 0.15, offsetY: 0.2, rotation: -15 })]);
  save('topbar-theme', tok(with_()), tok(with_(), 'light'));
  p('toolbar.zoom', [], [transform({ zoom: 1.5, offsetY: 0.3 })]);
  p('toolbar.rotate', [], [transform({ rotation: 90, offsetY: 0 })]);
  p('toolbar.flip', [transform({ rotation: 20 })], [transform({ rotation: 20, flipX: true })]);
  p('toolbar.flipV', [], [transform({ flipY: true, offsetY: -0.08 })]);
  p('toolbar.reset', [transform({ zoom: 1.6, offsetX: 0.3, rotation: 35 })], [boss, transform({ offsetY: 0 })]);
  p('toolbar.fit', [boss], [boss, transform({ zoom: 0.75, offsetY: 0 })]);
  p('toolbar.fill', [boss, transform({ zoom: 0.75, offsetY: 0 })], [boss]);

  // ---- The UI kit page's examples ----
  p('kit.slider', [], [(d) => (d.art.adjust = { ...d.art.adjust, brightness: 45 })]);
  p('kit.advanced', [], [(d) => (d.art.adjust = { ...d.art.adjust, hue: 30, temperature: 40, sepia: 25 })]);
  p('kit.swatches', [], [frame({ color: '#3f6fd8' })]);
  p('kit.segmented', [], [(d) => (d.shape = 'hexagon')]);
  p('kit.tiles', [], [framePreset('arcane')]);
  p('kit.toggle', [shadow('outer', { enabled: false })], [shadow('outer', { distance: 0.08, blur: 0.12 })], L);
  save('kit-strip', tok(empty()), tok(with_(boss)));
}
