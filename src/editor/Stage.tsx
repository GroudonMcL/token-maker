import { ImagePlus, ScanSearch } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useStore } from 'zustand';
import type { ArtTransform } from '../document/types';
import { HelpTip } from '../components/HelpTip';
import { artCorners, baseScale, imageClipPolygon, rotateAround, zoomAround } from '../render/geometry';
import { renderToken } from '../render/render';
import type { Point } from '../render/shapes';
import { assetStore } from '../state/assets';
import { commitDoc, useDoc } from '../state/tokenStore';
import { setTransform } from './artActions';
import { UploadButton } from './UploadButton';

const PADDING = 40;
const MIN_TOKEN = 160;
const MAX_TOKEN = 640;
const HANDLE_MARGIN = 18;
const VIEW_MAX = 8;
/** The token canvas never gets bigger than this many pixels across, however far the view is zoomed. */
const MAX_CANVAS = 4096;

/** How far the view (not the art) is zoomed in, and where the token centre has moved to. */
interface View {
  scale: number;
  x: number;
  y: number;
}
const HOME: View = { scale: 1, x: 0, y: 0 };

type Gesture =
  | { kind: 'pan'; start: ArtTransform; x: number; y: number; distance: number; angle: number }
  | { kind: 'view'; start: View; x: number; y: number }
  | { kind: 'scale' | 'rotate'; start: ArtTransform; centre: Point; startPoint: Point };

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
  const [viewState, setViewState] = useState({ key: '', view: HOME });
  const [spaceHeld, setSpaceHeld] = useState(false);

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

  // A new image or a resized window starts from the whole token in view.
  const viewKey = `${doc.art.assetId}|${box.width}|${box.height}`;
  const view = viewState.key === viewKey ? viewState.view : HOME;
  const setView = (next: View | ((v: View) => View)) =>
    setViewState((prev) => {
      const current = prev.key === viewKey ? prev.view : HOME;
      return { key: viewKey, view: typeof next === 'function' ? next(current) : next };
    });

  // Token centre in stage coordinates with the view at 100%.
  const cx0 = box.width / 2;
  const cy0 = reserveTop + availH / 2;
  // …and as currently viewed.
  const R = (tokenCss / 2) * view.scale;
  const cx = cx0 + view.x;
  const cy = cy0 + view.y;

  /** Keeps the scale in range and the token centre on screen; at 100% the token sits in the middle. */
  const clampView = (v: View): View => {
    const scale = Math.min(VIEW_MAX, Math.max(1, v.scale));
    if (scale <= 1.001) return HOME;
    return {
      scale,
      x: Math.min(box.width - cx0, Math.max(-cx0, v.x)),
      y: Math.min(box.height - reserveBottom - cy0, Math.max(reserveTop - cy0, v.y)),
    };
  };

  // Space + drag looks around a zoomed-in view, like most drawing apps.
  useEffect(() => {
    const typing = (e: KeyboardEvent) => (e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]');
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !typing(e)) {
        if (e.target === stageRef.current) e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpaceHeld(false);
    const blur = () => setSpaceHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
  const clip = imageClipPolygon(doc);

  // Draw on the next frame whenever anything visual changes.
  useEffect(() => {
    if (!box.width || !box.height) return;
    const frame = requestAnimationFrame(() => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const token = tokenRef.current;
      if (token) {
        const px = Math.min(MAX_CANVAS, Math.round(R * 2 * dpr));
        if (token.width !== px) {
          token.width = px;
          token.height = px;
        }
        const tctx = token.getContext('2d');
        if (tctx) renderToken(tctx, doc, assets, px);
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
        if (ctx && art) {
          const t = doc.art.transform;
          const s = baseScale(art.width, art.height, clip) * t.zoom * R * dpr;
          ctx.save();
          ctx.translate((cx + t.offsetX * R) * dpr, (cy + t.offsetY * R) * dpr);
          ctx.rotate((t.rotation * Math.PI) / 180);
          ctx.scale(t.flipX ? -s : s, t.flipY ? -s : s);
          ctx.imageSmoothingQuality = 'medium';
          ctx.drawImage(art.image, -art.width / 2, -art.height / 2);
          ctx.restore();
        }
      }
    });
    return () => cancelAnimationFrame(frame);
    // clip is derived from doc
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box, R, cx, cy, doc, assets, art]);

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

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!art) return;
    if ((e.target as HTMLElement).closest('.float-toolbar, .stage__handle, .stage__help, .stage__view, button, a, input')) return;
    // Middle button, or Space + drag: look around the zoomed view instead of moving the art.
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      e.preventDefault();
      stageRef.current?.setPointerCapture(e.pointerId);
      gesture.current = { kind: 'view', start: view, x: e.clientX, y: e.clientY };
      setDragging(true);
      return;
    }
    if (e.button > 0) return;
    stageRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDragging(true);
    startPan();
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (g?.kind === 'view') {
      setView(clampView({ ...g.start, x: g.start.x + e.clientX - g.x, y: g.start.y + e.clientY - g.y }));
      return;
    }
    if (!g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
    if (gesture.current?.kind === 'view') {
      gesture.current = null;
      setDragging(false);
      return;
    }
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size === 0) {
      setDragging(false);
      gesture.current = null;
      commitDoc();
    } else {
      startPan(); // a finger lifted: carry on with the rest
    }
  };

  // The art's corners on screen (for the wheel, the outline and the handles).
  const t = doc.art.transform;
  const corners = art ? artCorners(t, art.width, art.height, clip).map((p) => ({ x: cx + p.x * R, y: cy + p.y * R })) : [];

  // The wheel zooms the view (for close-up work) when over the token or the
  // art, and otherwise scrolls the side panel. It needs a non-passive
  // listener so the page doesn't scroll as well.
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  useEffect(() => {
    wheelRef.current = (e: WheelEvent) => {
      const rect = stageRef.current!.getBoundingClientRect();
      const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const overArt = !!art && ((Math.abs(p.x - cx) <= R && Math.abs(p.y - cy) <= R) || insidePolygon(p, corners));
      if (!overArt) {
        const panel = document.querySelector<HTMLElement>('.side-panel');
        if (!panel) return;
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? panel.clientHeight : 1;
        panel.scrollBy({ top: e.deltaY * unit, left: 0 });
        return;
      }
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      setView((v) => {
        const k = Math.min(VIEW_MAX, Math.max(1, v.scale * factor)) / v.scale;
        // Zoom around the pointer: the point under it stays put.
        return clampView({ scale: v.scale * k, x: p.x - (p.x - (cx0 + v.x)) * k - cx0, y: p.y - (p.y - (cy0 + v.y)) * k - cy0 });
      });
    };
  });
  useEffect(() => {
    const el = stageRef.current!;
    const onWheel = (e: WheelEvent) => wheelRef.current(e);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent) => {
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
  const centre = { x: cx + t.offsetX * R, y: cy + t.offsetY * R };
  const keepIn = (p: Point) => ({
    x: Math.min(box.width - HANDLE_MARGIN, Math.max(HANDLE_MARGIN, p.x)),
    y: Math.min(box.height - reserveBottom - HANDLE_MARGIN, Math.max(reserveTop + HANDLE_MARGIN, p.y)),
  });
  // The rotate handle sits beyond the middle of the art's top edge.
  const top = corners.length ? { x: (corners[0]!.x + corners[1]!.x) / 2, y: (corners[0]!.y + corners[1]!.y) / 2 } : centre;
  const up = Math.hypot(top.x - centre.x, top.y - centre.y) || 1;
  const rotateAt = { x: top.x + ((top.x - centre.x) / up) * 28, y: top.y + ((top.y - centre.y) / up) * 28 };
  const rotateHandle = keepIn(rotateAt);
  // At 100% a handle beyond the edge is pulled back on screen; zoomed in, it is hidden instead.
  const offScreen = (p: Point) => view.scale > 1 && (p.x !== keepIn(p).x || p.y !== keepIn(p).y);

  const startHandle = (kind: 'scale' | 'rotate', e: ReactPointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const rect = stageRef.current!.getBoundingClientRect();
    gesture.current = { kind, start: t, centre, startPoint: { x: e.clientX - rect.left, y: e.clientY - rect.top } };
    setDragging(true);
  };
  const moveHandle = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (!g || g.kind === 'pan' || g.kind === 'view') return;
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
      data-look={(spaceHeld && !!art) || undefined}
      data-view-zoomed={view.scale > 1 || undefined}
      tabIndex={art ? 0 : -1}
      aria-label={art ? 'Token preview. Drag to move the art, scroll to zoom the view, arrow keys to nudge.' : undefined}
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
        style={{ width: R * 2, height: R * 2, left: cx - R, top: cy - R }}
      />
      {art && corners.length === 4 && (
        <svg className="stage__overlay" width={box.width} height={box.height} aria-hidden="true">
          <polygon className="stage__outline" points={corners.map((p) => `${p.x},${p.y}`).join(' ')} />
        </svg>
      )}
      {art &&
        corners.map((p, i) => {
          const q = keepIn(p);
          if (offScreen(p)) return null;
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
      {art && !offScreen(rotateAt) && (
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
      {art && view.scale > 1 && (
        <button
          type="button"
          className="btn btn--ghost stage__view"
          style={{ bottom: reserveBottom + 12 }}
          onClick={() => setView(HOME)}
          aria-label={`View zoomed to ${Math.round(view.scale * 100)}%. Reset view`}
          title="Zoom the view back out to the whole token"
        >
          <ScanSearch size={16} aria-hidden="true" />
          View <span className="num">{Math.round(view.scale * 100)}%</span> · Reset
        </button>
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

/** Is `p` inside the convex polygon `poly` (either winding)? */
function insidePolygon(p: Point, poly: Point[]): boolean {
  if (poly.length < 3) return false;
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross === 0) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}
