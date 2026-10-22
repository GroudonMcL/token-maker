// What a drag on the canvas does: move the art (normal), paint the
// erase/restore brush, or pick the background colour with the eyedropper.
// Brush settings are remembered in this browser (DESIGN.md §3: small UI
// preferences in localStorage).

import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

export type Tool = 'move' | 'brush' | 'eyedropper';

export interface ToolState {
  tool: Tool;
  brushMode: 'erase' | 'restore';
  /** Brush diameter in screen pixels. */
  brushSize: number;
  /** 0–100. */
  brushSoftness: number;
  /** Pen pressure makes the line thinner when you press lightly. */
  usePressure: boolean;
  /** Tint removed areas red while the brush is on. */
  showRemoved: boolean;
}

export const BRUSH_MIN = 4;
export const BRUSH_MAX = 200;

const PREFS_KEY = 'token-maker:brush';
const DEFAULTS: ToolState = { tool: 'move', brushMode: 'erase', brushSize: 40, brushSoftness: 40, usePressure: true, showRemoved: true };

function loadPrefs(): Partial<ToolState> {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<ToolState>;
    return {
      brushMode: raw.brushMode === 'restore' ? 'restore' : 'erase',
      brushSize: typeof raw.brushSize === 'number' ? Math.min(BRUSH_MAX, Math.max(BRUSH_MIN, raw.brushSize)) : DEFAULTS.brushSize,
      brushSoftness: typeof raw.brushSoftness === 'number' ? Math.min(100, Math.max(0, raw.brushSoftness)) : DEFAULTS.brushSoftness,
      usePressure: typeof raw.usePressure === 'boolean' ? raw.usePressure : DEFAULTS.usePressure,
      showRemoved: typeof raw.showRemoved === 'boolean' ? raw.showRemoved : DEFAULTS.showRemoved,
    };
  } catch {
    return {};
  }
}

export const toolStore = createStore<ToolState>(() => ({ ...DEFAULTS, ...loadPrefs() }));

toolStore.subscribe((s) => {
  try {
    const { brushMode, brushSize, brushSoftness, usePressure, showRemoved } = s;
    localStorage.setItem(PREFS_KEY, JSON.stringify({ brushMode, brushSize, brushSoftness, usePressure, showRemoved }));
  } catch {
    /* private mode: just don't remember */
  }
});

export function useTool<T>(select: (s: ToolState) => T): T {
  return useStore(toolStore, select);
}

export const setTool = (tool: Tool) => toolStore.setState({ tool });
export const setBrush = (patch: Partial<Omit<ToolState, 'tool'>>) => toolStore.setState(patch);
