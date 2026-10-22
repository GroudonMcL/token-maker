// What a drag on the canvas does: move the art (normal), paint the
// erase/restore brush, pick the background colour with the eyedropper, move
// the background picture, or paint the pop-out mask.
// Brush settings are remembered in this browser (DESIGN.md §3: small UI
// preferences in localStorage).

import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

/** move the art · paint the brush · pick a colour · move the background picture (Phase 4) · paint the pop-out mask (Phase 5). */
export type Tool = 'move' | 'brush' | 'eyedropper' | 'background' | 'popout';

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
  /** The pop-out brush adds to the pop-out or erases from it. It shares size, softness and pressure with the other brush. */
  popOutMode: 'add' | 'erase';
  /** Show the pop-out mask as a coloured overlay while painting it. */
  showPopOut: boolean;
  /** The decoration picked on the canvas or in the panel (Phase 7); it gets handles. Not remembered. */
  selectedDecoration: string | null;
}

export const BRUSH_MIN = 4;
export const BRUSH_MAX = 200;

const PREFS_KEY = 'token-maker:brush';
export const DEFAULTS: ToolState = {
  tool: 'move',
  brushMode: 'erase',
  brushSize: 40,
  brushSoftness: 40,
  usePressure: true,
  showRemoved: true,
  popOutMode: 'add',
  showPopOut: true,
  selectedDecoration: null,
};

function loadPrefs(): Partial<ToolState> {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<ToolState>;
    return {
      brushMode: raw.brushMode === 'restore' ? 'restore' : 'erase',
      brushSize: typeof raw.brushSize === 'number' ? Math.min(BRUSH_MAX, Math.max(BRUSH_MIN, raw.brushSize)) : DEFAULTS.brushSize,
      brushSoftness: typeof raw.brushSoftness === 'number' ? Math.min(100, Math.max(0, raw.brushSoftness)) : DEFAULTS.brushSoftness,
      usePressure: typeof raw.usePressure === 'boolean' ? raw.usePressure : DEFAULTS.usePressure,
      showRemoved: typeof raw.showRemoved === 'boolean' ? raw.showRemoved : DEFAULTS.showRemoved,
      popOutMode: raw.popOutMode === 'erase' ? 'erase' : 'add',
      showPopOut: typeof raw.showPopOut === 'boolean' ? raw.showPopOut : DEFAULTS.showPopOut,
    };
  } catch {
    return {};
  }
}

export const toolStore = createStore<ToolState>(() => ({ ...DEFAULTS, ...loadPrefs() }));

toolStore.subscribe((s) => {
  try {
    const { brushMode, brushSize, brushSoftness, usePressure, showRemoved, popOutMode, showPopOut } = s;
    localStorage.setItem(PREFS_KEY, JSON.stringify({ brushMode, brushSize, brushSoftness, usePressure, showRemoved, popOutMode, showPopOut }));
  } catch {
    /* private mode: just don't remember */
  }
});

export function useTool<T>(select: (s: ToolState) => T): T {
  return useStore(toolStore, select);
}

export const setTool = (tool: Tool) => toolStore.setState({ tool });
export const setBrush = (patch: Partial<Omit<ToolState, 'tool'>>) => toolStore.setState(patch);
export const selectDecoration = (id: string | null) => toolStore.setState({ selectedDecoration: id });
