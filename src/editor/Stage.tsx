import { Check, Eraser, ImagePlus, Undo2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useStore } from 'zustand';
import type { ArtTransform, MaskStroke } from '../document/types';
import { HelpTip } from '../components/HelpTip';
import { requestFullArt, useProcessedVersion } from '../image/artWorker';
import { maskOverlay } from '../image/maskOverlay';
import { DRAFT_SIDE, peekProcessedArt, processedArt, sourcePixels } from '../image/processedArt';
import { artCorners, baseScale, imageClipPolygon, imagePointAt, rotateAround, zoomAround } from '../render/geometry';
import { renderToken } from '../render/render';
import type { Point } from '../render/shapes';
import { assetStore } from '../state/assets';
import { commitDoc, docHistory, updateDoc, useDoc } from '../state/tokenStore';
import { toast } from '../ui/toast';
import { setTransform } from './artActions';
import { extendStroke, pickColour, pointerPressure, startStroke, type StrokeContext } from './brush';
import { setBrush, setTool, toolStore, useTool } from './tools';
import { UploadButton } from './UploadButton';

const PADDING = 40;
const MIN_TOKEN = 160;
const MAX_TOKEN = 640;
const HANDLE_MARGIN = 18;

type Gesture =
  | { kind: 'pan'; start: ArtTransform; x: number; y: number; distance: number; angle: number }
  | { kind: 'scale' | 'rotate'; start: ArtTransform; centre: Point; startPoint: Point }
  | { kind: 'brush'; stroke: MaskStroke; index: number };

/**
 * The canvas: the token (drawn by the same renderer as the export), the whole
 * art dimmed behind it, and handles to resize and rotate the art. Works with
 * mouse, touch and pen through pointer events.
 */
export function Stage({ reserveTop = 64, reserveBottom = 0 }: { reserveTop?: number; reserveBottom?: number }) {
  const doc = useDoc();
  const assets = useStore(assetStore, (s) => s.assets);
  const art = doc.art.assetId ? assets.get(doc.art.assetId) : undefined;
  const stageRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLCanvasElement>(null);
  const tokenRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const tool = useTool((s) => (art ? s.tool : 'move'));
  const brushSize = useTool((s) => s.brushSize);
  const showRemoved = useTool((s) => s.showRemoved);
  const [cursor, setCursor] = useState<Point | null>(null);

  // Processed art: the full-size result when ready, else a quick copy (DESIGN.md §5).
  const settling = useStore(docHistory, (s) => s.pendingBase !== null);
  const version = useProcessedVersion();
  const edits = doc.art;
  const display = art ? (peekProcessedArt(art, edits) ?? processedArt(art, edits, DRAFT_SIDE)) : null;
  const needsFull = !!art && !peekProcessedArt(art, edits);
  useEffect(() => {
    // Ask the worker for the full-size art once a drag has finished.
    if (art && needsFull && !settling) void requestFullArt(art, edits);
  }, [art, edits, needsFull, settling, version]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setBox({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const availH = box.height - reserveTop - reserveBottom;
  const tokenCss = Math.round(Math.max(MIN_TOKEN, Math.min(MAX_TOKEN, Math.min(box.width, availH) - PADDING * 2)));
  const R = tokenCss / 2;
  // Token centre in stage coordinates.
  const cx = box.width / 2;
  const cy = reserveTop + availH / 2;
  const clip = imageClipPolygon(doc);

  /** Draws an image of the art's shape (the art, or its mask) where the art is on screen. */
  function drawArt(ctx: CanvasRenderingContext2D, image: CanvasImageSource, dpr: number) {
    if (!art) return;
    const t = doc.art.transform;
    const s = baseScale(art.width, art.height, clip) * t.zoom * R * dpr;
    ctx.save();
    ctx.translate((cx + t.offsetX * R) * dpr, (cy + t.offsetY * R) * dpr);
    ctx.rotate((t.rotation * Math.PI) / 180);
    ctx.scale(t.flipX ? -s : s, t.flipY ? -s : s);
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(image, -art.width / 2, -art.height / 2, art.width, art.height);
    ctx.restore();
  }

  // Draw on the next frame whenever anything visual changes.
  useEffect(() => {
    if (!box.width || !box.height) return;
    const frame = requestAnimationFrame(() => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const token = tokenRef.current;
      if (token) {
        const px = Math.round(tokenCss * dpr);
        if (token.width !== px) {
          token.width = px;
          token.height = px;
        }
        const tctx = token.getContext('2d');
        if (tctx) renderToken(tctx, doc, assets, px, { processedArt: display?.source });
      }
      const context = contextRef.current;
      if (context) {
        const w = Math.round(box.width * dpr);
        const h = Math.round(box.height * dpr);
        if (context.width !== w || context.height !== h) {
          context.width = w;
          context.height = h;
        }
        const ctx = context.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, w, h);
        if (ctx && art && display) drawArt(ctx, display.source.image, dpr);
      }
      // Removed parts tinted red while the brush is on.
      const maskCanvas = maskRef.current;
      if (maskCanvas) {
        const w = Math.round(box.width * dpr);
        const h = Math.round(box.height * dpr);
        if (maskCanvas.width !== w || maskCanvas.height !== h) {
          maskCanvas.width = w;
          maskCanvas.height = h;
        }
        const ctx = maskCanvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, w, h);
        if (ctx && art && display?.mask && tool === 'brush' && showRemoved && clip.length) {
          // Only inside the frame's opening, where the art shows.
          ctx.save();
          ctx.beginPath();
          clip.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo']((cx + p.x * R) * dpr, (cy + p.y * R) * dpr));
          ctx.closePath();
          ctx.clip();
          drawArt(ctx, maskOverlay(display.mask, display.maskWidth, display.maskHeight), dpr);
          ctx.restore();
        }
      }
    });
    return () => cancelAnimationFrame(frame);
    // clip and drawArt are derived from doc
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box, tokenCss, R, cx, cy, doc, assets, art, display, tool, showRemoved]);

  const strokeContext = (): StrokeContext | null =>
    art ? { transform: doc.art.transform, width: art.width, height: art.height, clip, R } : null;

  /** Client position → R units from the token centre. */
  const toUnits = (clientX: number, clientY: number): Point => {
    const rect = stageRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left - cx) / R, y: (clientY - rect.top - cy) / R };
  };

  const startPan = () => {
    const pts = [...pointers.current.values()];
    const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const [a, b] = pts;
    gesture.current = {
      kind: 'pan',
      start: doc.art.transform,
      x,
      y,
      distance: a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0,
      angle: a && b ? Math.atan2(b.y - a.y, b.x - a.x) : 0,
    };
  };

  /** Removes a stroke that was just started (a second finger turned it into a pinch). */
  const cancelStroke = (g: Extract<Gesture, { kind: 'brush' }>) => {
    updateDoc((d) => ({ ...d, art: { ...d.art, strokes: d.art.strokes.filter((_, i) => i !== g.index) } }), { transient: true });
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!art || e.button > 0) return;
    if ((e.target as HTMLElement).closest('.float-toolbar, .stage__handle, .stage__help, .stage__toolbar, button, a, input')) return;
    stageRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDragging(true);
    const g = gesture.current;
    if (g?.kind === 'brush') cancelStroke(g); // two fingers: move and zoom instead
    if (pointers.current.size === 1 && tool === 'eyedropper') {
      pickBackground(e.clientX, e.clientY);
      gesture.current = null;
      return;
    }
    if (pointers.current.size === 1 && tool === 'brush') {
      const c = strokeContext()!;
      const { brushMode, brushSize: sizePx, brushSoftness, usePressure } = toolStore.getState();
      const stroke = startStroke(c, toUnits(e.clientX, e.clientY), pointerPressure(e, usePressure), {
        mode: brushMode,
        sizePx,
        softness: brushSoftness,
      });
      const index = doc.art.strokes.length;
      gesture.current = { kind: 'brush', stroke, index };
      updateDoc((d) => ({ ...d, art: { ...d.art, strokes: [...d.art.strokes, stroke] } }), { transient: true });
      return;
    }
    startPan();
  };

  /** Eyedropper: the tapped colour becomes the background colour to remove. */
  const pickBackground = (clientX: number, clientY: number) => {
    if (!art) return;
    const q = imagePointAt(doc.art.transform, art.width, art.height, clip, toUnits(clientX, clientY));
    const colour = pickColour(sourcePixels(art, DRAFT_SIDE), q.x, q.y);
    if (!colour) {
      toast('Tap on the picture to pick its background colour.', 'error');
      return;
    }
    updateDoc((d) => ({ ...d, art: { ...d.art, removal: { ...d.art.removal, enabled: true, color: colour } } }));
    setTool('move');
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (tool === 'brush' && e.pointerType !== 'touch') {
      const rect = stageRef.current!.getBoundingClientRect();
      setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.kind === 'brush') {
      const c = strokeContext()!;
      const next = extendStroke(c, g.stroke, toUnits(e.clientX, e.clientY), pointerPressure(e, toolStore.getState().usePressure));
      if (next === g.stroke) return;
      g.stroke = next;
      updateDoc((d) => ({ ...d, art: { ...d.art, strokes: d.art.strokes.map((s, i) => (i === g.index ? next : s)) } }), { transient: true });
      return;
    }
    if (g.kind !== 'pan') return;
    const pts = [...pointers.current.values()];
    const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    let next: ArtTransform = { ...g.start, offsetX: g.start.offsetX + (x - g.x) / R, offsetY: g.start.offsetY + (y - g.y) / R };
    const [a, b] = pts;
    if (a && b && g.distance > 0) {
      // Pinch to zoom and twist to rotate, both around the fingers' midpoint.
      const anchor = toUnits(x, y);
      next = zoomAround(next, Math.hypot(a.x - b.x, a.y - b.y) / g.distance, anchor);
      const turn = ((Math.atan2(b.y - a.y, b.x - a.x) - g.angle) * 180) / Math.PI;
      next = rotateAround(next, turn, anchor);
    }
    setTransform(() => next, { transient: true });
  };

  const endPointer = (e: ReactPointerEvent) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size === 0) {
      setDragging(false);
      gesture.current = null;
      commitDoc(); // a whole stroke or drag is one undo step
    } else if (gesture.current?.kind !== 'brush') {
      startPan(); // a finger lifted: carry on with the rest
    }
  };

  // Wheel zoom needs a non-passive listener so the page doesn't scroll.
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  useEffect(() => {
    wheelRef.current = (e: WheelEvent) => {
      if (!art) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      setTransform((t) => zoomAround(t, factor, toUnits(e.clientX, e.clientY)), { transient: true });
      clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(commitDoc, 350); // one undo step per burst of scrolling
    };
  });
  useEffect(() => {
    const el = stageRef.current!;
    const onWheel = (e: WheelEvent) => wheelRef.current(e);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape' && tool !== 'move') {
      setTool('move');
      return;
    }
    if (!art || e.target !== stageRef.current) return;
    const step = e.shiftKey ? 0.08 : 0.015;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      setTransform((t) => ({ ...t, offsetX: t.offsetX + m[0], offsetY: t.offsetY + m[1] }));
    } else if (e.key === '+' || e.key === '=') {
      setTransform((t) => zoomAround(t, 1.1, { x: 0, y: 0 }));
    } else if (e.key === '-') {
      setTransform((t) => zoomAround(t, 1 / 1.1, { x: 0, y: 0 }));
    }
  };

  // ---- Resize and rotate handles ----
  const t = doc.art.transform;
  const corners = art ? artCorners(t, art.width, art.height, clip).map((p) => ({ x: cx + p.x * R, y: cy + p.y * R })) : [];
  const centre = { x: cx + t.offsetX * R, y: cy + t.offsetY * R };
  const keepIn = (p: Point) => ({
    x: Math.min(box.width - HANDLE_MARGIN, Math.max(HANDLE_MARGIN, p.x)),
    y: Math.min(box.height - reserveBottom - HANDLE_MARGIN, Math.max(reserveTop + HANDLE_MARGIN, p.y)),
  });
  // The rotate handle sits beyond the middle of the art's top edge.
  const top = corners.length ? { x: (corners[0]!.x + corners[1]!.x) / 2, y: (corners[0]!.y + corners[1]!.y) / 2 } : centre;
  const up = Math.hypot(top.x - centre.x, top.y - centre.y) || 1;
  const rotateHandle = keepIn({ x: top.x + ((top.x - centre.x) / up) * 28, y: top.y + ((top.y - centre.y) / up) * 28 });

  const startHandle = (kind: 'scale' | 'rotate', e: ReactPointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const rect = stageRef.current!.getBoundingClientRect();
    gesture.current = { kind, start: t, centre, startPoint: { x: e.clientX - rect.left, y: e.clientY - rect.top } };
    setDragging(true);
  };
  const moveHandle = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (!g || g.kind === 'pan' || g.kind === 'brush') return;
    const rect = stageRef.current!.getBoundingClientRect();
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const from = { x: g.startPoint.x - g.centre.x, y: g.startPoint.y - g.centre.y };
    const to = { x: p.x - g.centre.x, y: p.y - g.centre.y };
    const anchor = { x: g.start.offsetX, y: g.start.offsetY };
    if (g.kind === 'scale') {
      const factor = Math.hypot(to.x, to.y) / Math.max(1, Math.hypot(from.x, from.y));
      setTransform(() => zoomAround(g.start, factor, anchor), { transient: true });
    } else {
      let turn = ((Math.atan2(to.y, to.x) - Math.atan2(from.y, from.x)) * 180) / Math.PI;
      if (e.shiftKey) turn = Math.round((g.start.rotation + turn) / 15) * 15 - g.start.rotation;
      setTransform(() => rotateAround(g.start, turn, anchor), { transient: true });
    }
  };
  const endHandle = () => {
    if (!gesture.current) return;
    gesture.current = null;
    setDragging(false);
    commitDoc();
  };

  return (
    <div
      ref={stageRef}
      className="stage"
      data-dragging={dragging || undefined}
      data-has-art={!!art || undefined}
      data-tool={tool}
      onPointerLeave={() => setCursor(null)}
      tabIndex={art ? 0 : -1}
      aria-label={art ? 'Token preview. Drag to move the art, scroll to zoom, arrow keys to nudge.' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onKeyDown={onKeyDown}
    >
      <canvas ref={contextRef} className="stage__context" aria-hidden="true" />
      <canvas
        ref={tokenRef}
        className="stage__token"
        data-testid="token-canvas"
        role="img"
        aria-label={`Token preview: ${doc.name}`}
        style={{ width: tokenCss, height: tokenCss, left: cx - R, top: cy - R }}
      />
      <canvas ref={maskRef} className="stage__mask" aria-hidden="true" />
      {art && corners.length === 4 && (
        <svg className="stage__overlay" width={box.width} height={box.height} aria-hidden="true">
          <polygon className="stage__outline" points={corners.map((p) => `${p.x},${p.y}`).join(' ')} />
        </svg>
      )}
      {art &&
        tool === 'move' &&
        corners.map((p, i) => {
          const q = keepIn(p);
          return (
            <span
              key={i}
              className="stage__handle stage__handle--scale"
              style={{ left: q.x, top: q.y }}
              data-testid={`scale-handle-${i}`}
              onPointerDown={(e) => startHandle('scale', e)}
              onPointerMove={moveHandle}
              onPointerUp={endHandle}
              onPointerCancel={endHandle}
            />
          );
        })}
      {art && tool === 'move' && (
        <span
          className="stage__handle stage__handle--rotate"
          style={{ left: rotateHandle.x, top: rotateHandle.y }}
          data-testid="rotate-handle"
          onPointerDown={(e) => startHandle('rotate', e)}
          onPointerMove={moveHandle}
          onPointerUp={endHandle}
          onPointerCancel={endHandle}
        />
      )}
      {tool !== 'move' && <ToolBar bottom={reserveBottom + 12} />}
      {tool === 'brush' && cursor && (
        <span className="stage__brush-cursor" aria-hidden="true" style={{ left: cursor.x, top: cursor.y, width: brushSize, height: brushSize }} />
      )}
      {art && (
        <div className="stage__help" data-control="stage" data-help-id="canvas.stage" style={{ bottom: reserveBottom + 12 }}>
          <HelpTip id="canvas.stage" />
        </div>
      )}
      {!art && (
        <div className="stage__empty" style={{ top: cy + R + 16 }}>
          <p className="canvas-area__hint">
            <strong>Drop, paste or upload an image</strong>
            <span>to start your token</span>
          </p>
          <UploadButton>
            <ImagePlus size={18} aria-hidden="true" />
            Upload image
          </UploadButton>
        </div>
      )}
    </div>
  );
}

/** Shown on the canvas while the brush or eyedropper is on: quick mode switch and Done. */
function ToolBar({ bottom }: { bottom: number }) {
  const tool = useTool((s) => s.tool);
  const mode = useTool((s) => s.brushMode);
  return (
    <div className="stage__toolbar" role="toolbar" aria-label={tool === 'brush' ? 'Brush' : 'Eyedropper'} style={{ bottom }}>
      {tool === 'brush' ? (
        <>
          <button type="button" className="stage__tool-btn" aria-pressed={mode === 'erase'} onClick={() => setBrush({ brushMode: 'erase' })}>
            <Eraser size={16} aria-hidden="true" />
            Erase
          </button>
          <button type="button" className="stage__tool-btn" aria-pressed={mode === 'restore'} onClick={() => setBrush({ brushMode: 'restore' })}>
            <Undo2 size={16} aria-hidden="true" />
            Restore
          </button>
        </>
      ) : (
        <span className="stage__tool-hint">Tap the background colour</span>
      )}
      <button type="button" className="btn btn--primary btn--small" onClick={() => setTool('move')}>
        <Check size={16} aria-hidden="true" />
        Done
      </button>
    </div>
  );
}
