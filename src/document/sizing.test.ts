import { createDocument } from './defaults';
import { computeInsets, outputSize, perSquareToPx, squaresLabel } from './sizing';

describe('per-square sizing (DESIGN.md §4.2)', () => {
  it('output size is squares × pixels per square, capped at 4096', () => {
    expect(outputSize(1)).toBe(256);
    expect(outputSize(0.5)).toBe(128);
    expect(outputSize(2)).toBe(512);
    expect(outputSize(4, 512)).toBe(2048);
    expect(outputSize(10, 512)).toBe(4096);
  });

  it('a border is the same number of pixels per square at every size', () => {
    for (const squares of [0.5, 1, 2, 3, 4]) {
      const size = outputSize(squares);
      expect(perSquareToPx(0.14, squares, size)).toBeCloseTo(0.14 * 128, 6);
    }
  });

  it('insets shrink as a fraction of the token as it gets bigger', () => {
    const medium = createDocument();
    const large = { ...medium, size: { preset: 'large' as const, squares: 2 } };
    const m = computeInsets(medium);
    const l = computeInsets(large);
    expect(l.frameInner).toBeCloseTo(m.frameInner / 2, 6);
    expect(l.frameInner * 512).toBeCloseTo(m.frameInner * 256, 6); // same pixels in the output
  });

  it('never lets the frame eat the whole art on tiny tokens', () => {
    const doc = createDocument();
    doc.size = { preset: 'tiny', squares: 0.5 };
    doc.frame = { ...doc.frame, thickness: 0.4, outerSpacing: 0.3, innerSpacing: 0.3 };
    expect(computeInsets(doc).image).toBeLessThan(0.9);
  });

  it('runs the art under half the border when there is no inner spacing', () => {
    const i = computeInsets(createDocument());
    expect(i.image).toBeCloseTo((i.frameOuter + i.frameInner) / 2, 6);
  });

  it('labels sizes', () => {
    expect(squaresLabel(0.5)).toBe('½ square');
    expect(squaresLabel(1)).toBe('1 square');
    expect(squaresLabel(3)).toBe('3 × 3 squares');
  });
});
