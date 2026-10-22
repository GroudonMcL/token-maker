import { useEffect, useRef } from 'react';
import { DEFAULT_ADJUST, DEFAULT_REMOVAL } from '../document/defaults';
import type { BackgroundRemoval, BrushStroke, ImageAdjustments } from '../document/types';
import { newCanvas, processArt, type ArtSettings } from '../image/processArt';
import type { RenderSource } from '../render/render';
import { sampleArt } from '../render/sampleArt';

/**
 * What a help card's before/after picture shows. The pictures are made live
 * by the real image code from small code-drawn samples, so they always match
 * what the control does (DESIGN.md §11).
 */
export interface HelpPreview {
  adjust?: Partial<ImageAdjustments>;
  removal?: Partial<BackgroundRemoval>;
  /** Brush demos: erase a leftover patch, or restore a part erased by mistake. */
  brush?: 'erase' | 'restore';
}

const make = (w: number, h: number) => newCanvas(w, h) as HTMLCanvasElement;
let portrait: RenderSource | null = null;
let cutout: RenderSource | null = null;

/** A figure on a flat green background, with a grey patch at its feet that removal leaves behind. */
function cutoutSample(): RenderSource {
  const size = 160;
  const c = make(size, size);
  const a = c.getContext('2d')!;
  a.fillStyle = '#3fbf5a';
  a.fillRect(0, 0, size, size);
  a.fillStyle = '#7a7f86';
  a.beginPath();
  a.ellipse(80, 146, 46, 10, 0, 0, Math.PI * 2);
  a.fill();
  a.fillStyle = '#6b2a2a';
  a.fillRect(56, 76, 48, 72);
  a.fillStyle = '#e0b48a';
  a.beginPath();
  a.arc(80, 56, 24, 0, Math.PI * 2);
  a.fill();
  return { image: c, width: size, height: size };
}

const removeOn: BackgroundRemoval = { ...DEFAULT_REMOVAL, enabled: true };
const erasePatch: BrushStroke = { id: 'help-erase', mode: 'erase', radius: 0.09, softness: 0.3, points: [0.22, 0.91, 1, 0.5, 0.92, 1, 0.78, 0.91, 1] };
const eraseHead: BrushStroke = { id: 'help-cut', mode: 'erase', radius: 0.1, softness: 0.2, points: [0.4, 0.3, 1, 0.6, 0.4, 1] };
const restoreHead: BrushStroke = { id: 'help-restore', mode: 'restore', radius: 0.12, softness: 0.2, points: [0.4, 0.3, 1, 0.6, 0.4, 1] };

function settingsFor(p: HelpPreview): { source: RenderSource; before: ArtSettings; after: ArtSettings } {
  const none: ArtSettings = { adjust: DEFAULT_ADJUST, removal: DEFAULT_REMOVAL, strokes: [] };
  if (p.brush || p.removal) {
    cutout ??= cutoutSample();
    if (p.brush === 'erase') return { source: cutout, before: { ...none, removal: removeOn }, after: { ...none, removal: removeOn, strokes: [erasePatch] } };
    if (p.brush === 'restore') {
      const cut = { ...none, removal: removeOn, strokes: [erasePatch, eraseHead] };
      return { source: cutout, before: cut, after: { ...cut, strokes: [erasePatch, eraseHead, restoreHead] } };
    }
    return { source: cutout, before: none, after: { ...none, removal: { ...removeOn, ...p.removal } } };
  }
  portrait ??= sampleArt(make, 160);
  return { source: portrait, before: none, after: { ...none, adjust: { ...DEFAULT_ADJUST, ...p.adjust } } };
}

function paint(canvas: HTMLCanvasElement | null, source: RenderSource, settings: ArtSettings) {
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;
  // A checkerboard, so see-through parts show as see-through.
  const cell = 8;
  for (let y = 0; y < canvas.height; y += cell) {
    for (let x = 0; x < canvas.width; x += cell) {
      ctx.fillStyle = (x / cell + y / cell) % 2 ? '#9a9a9a' : '#d6d6d6';
      ctx.fillRect(x, y, cell, cell);
    }
  }
  ctx.drawImage(processArt(source, settings).image, 0, 0, canvas.width, canvas.height);
}

/** Two small pictures, before and after, for a help card. */
export function BeforeAfter({ preview }: { preview: HelpPreview }) {
  const before = useRef<HTMLCanvasElement>(null);
  const after = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const s = settingsFor(preview);
    paint(before.current, s.source, s.before);
    paint(after.current, s.source, s.after);
  }, [preview]);
  return (
    <span className="before-after" aria-hidden="true">
      <span className="before-after__item">
        <canvas ref={before} width={88} height={88} />
        <span>Before</span>
      </span>
      <span className="before-after__item">
        <canvas ref={after} width={88} height={88} />
        <span>After</span>
      </span>
    </span>
  );
}
