// Per-grid-square sizing maths (DESIGN.md §4.2).

import type { TokenDocument } from './types';

/** Default and allowed output resolution, pixels per grid square (DESIGN.md §6.11). */
export const DEFAULT_PX_PER_SQUARE = 256;
export const MAX_OUTPUT_SIDE = 4096;

/** Final image side in pixels: squares × pixels per square, capped. */
export function outputSize(squares: number, pxPerSquare = DEFAULT_PX_PER_SQUARE): number {
  return Math.max(1, Math.min(MAX_OUTPUT_SIDE, Math.round(squares * pxPerSquare)));
}

/**
 * Converts a per-square length (1 = half a square) into a fraction of this
 * token's half-size. A Large token is 2 squares wide, so the same border is
 * half as big a fraction of it, and the same size on the map.
 */
export function perSquareToTokenUnits(value: number, squares: number): number {
  return value / squares;
}

/** Converts a per-square length into pixels for a token rendered `size` px wide. */
export function perSquareToPx(value: number, squares: number, size: number): number {
  return perSquareToTokenUnits(value, squares) * (size / 2);
}

export interface Insets {
  /** Outer edge of the frame band. */
  frameOuter: number;
  /** Inner edge of the frame band. */
  frameInner: number;
  /** Where the backing is painted from. */
  backing: number;
  /** Where the art is clipped. */
  image: number;
}

/** Largest total inset allowed, so tiny tokens never lose all their art. */
const MAX_INSET = 0.85;

/**
 * Frame insets as fractions of the token's half-size. With no inner spacing
 * the art runs under half the border to avoid a seam (as in the extension).
 */
export function computeInsets(doc: Pick<TokenDocument, 'frame' | 'size'>): Insets {
  const sq = doc.size.squares;
  const f = doc.frame;
  // A Frame Studio design always has a band (its own style setting isn't used).
  let border = f.style === 'none' && f.kind !== 'design' ? 0 : perSquareToTokenUnits(f.thickness, sq);
  let margin = perSquareToTokenUnits(f.outerSpacing, sq);
  let padding = perSquareToTokenUnits(f.innerSpacing, sq);
  const total = border + margin + padding;
  if (total > MAX_INSET) {
    const k = MAX_INSET / total;
    border *= k;
    margin *= k;
    padding *= k;
  }
  const frameOuter = margin;
  const frameInner = margin + border;
  return {
    frameOuter,
    frameInner,
    backing: frameOuter + border / 2,
    image: padding > 0 ? frameInner + padding : frameOuter + border / 2,
  };
}

/** "½ square", "1 square", "2 × 2 squares". */
export function squaresLabel(squares: number): string {
  if (squares === 0.5) return '½ square';
  if (squares < 1) return `${squares} of a square`;
  return squares === 1 ? '1 square' : `${squares} × ${squares} squares`;
}
