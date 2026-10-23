import { create } from 'zustand';

export const PEEK_HEIGHT = 140; // the phone bottom sheet's handle + summary row + tab row

/**
 * How much of the canvas the sheet covers once it has settled (Phase 10), so
 * the token moves up into the space above a half-open sheet instead of
 * hiding behind it. Not updated while dragging, so the token doesn't jump about.
 */
export const useSheetCover = create<number>(() => PEEK_HEIGHT);
