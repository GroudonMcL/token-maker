// What the pointer does on the canvas, and the brush settings. These are
// editor settings, not part of the token, so they live outside the document
// (the brush settings are remembered in this browser).

import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

/** move: drag the art · erase/restore: the brush · pick: the background eyedropper. */
export type Tool = 'move' | 'erase' | 'restore' | 'pick';

export interface BrushSettings {
  /** Diameter on screen, in CSS pixels, so zooming the view in gives finer strokes. */
  size: number;
  /** 0 (hard) … 100 (very soft). */
  softness: number;
  /** Simple mode shows one slider (size) and uses a medium softness. */
  simple: boolean;
}

export const BRUSH_MIN = 4;
export const BRUSH_MAX = 200;
export const SIMPLE_SOFTNESS = 40;
export const DEFAULT_BRUSH: BrushSettings = { size: 40, softness: SIMPLE_SOFTNESS, simple: true };
const STORAGE_KEY = 'token-maker:brush';

function loadBrush(): BrushSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<BrushSettings> | null;
    if (!saved) return DEFAULT_BRUSH;
    const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
    return {
      size: num(saved.size, DEFAULT_BRUSH.size, BRUSH_MIN, BRUSH_MAX),
      softness: num(saved.softness, DEFAULT_BRUSH.softness, 0, 100),
      simple: typeof saved.simple === 'boolean' ? saved.simple : DEFAULT_BRUSH.simple,
    };
  } catch {
    return DEFAULT_BRUSH;
  }
}

interface ToolState {
  tool: Tool;
  brush: BrushSettings;
}

export const toolStore = createStore<ToolState>(() => ({ tool: 'move', brush: loadBrush() }));

export function useTool<T>(select: (s: ToolState) => T): T {
  return useStore(toolStore, select);
}

export const getTool = () => toolStore.getState().tool;

export function setTool(tool: Tool): void {
  toolStore.setState({ tool });
}

export function setBrush(patch: Partial<BrushSettings>): void {
  const brush = { ...toolStore.getState().brush, ...patch };
  brush.size = Math.min(BRUSH_MAX, Math.max(BRUSH_MIN, brush.size));
  toolStore.setState({ brush });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(brush));
  } catch {
    /* private mode: just don't remember it */
  }
}

/** The softness actually used, 0–1 (simple mode uses a fixed medium softness). */
export const brushSoftness = (b: BrushSettings) => (b.simple ? SIMPLE_SOFTNESS : b.softness) / 100;
