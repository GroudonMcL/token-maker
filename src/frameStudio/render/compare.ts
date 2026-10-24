// Measuring how far apart two pictures are (Phase 4's conversion tests and
// npm run compare-conversions). Colours are compared premultiplied, so a
// difference in a nearly see-through pixel counts for little, as it does to
// the eye.

export interface Difference {
  /** Mean difference per channel, 0–255, over the whole picture. */
  mean: number;
  /** Share of pixels (0–1) where some channel differs by more than the threshold. */
  over: number;
  /** The largest difference in any channel, 0–255. */
  max: number;
  /** Each pixel's largest channel difference, 0–255. */
  map: Uint8Array;
}

/** Compares two RGBA pictures of the same size; `threshold` (0–255) is what counts as a visible difference. */
export function compareFrames(a: Uint8ClampedArray, b: Uint8ClampedArray, threshold = 24): Difference {
  const pixels = a.length / 4;
  const map = new Uint8Array(pixels);
  let sum = 0;
  let over = 0;
  let max = 0;
  for (let p = 0; p < pixels; p++) {
    const i = p * 4;
    const aa = a[i + 3];
    const ba = b[i + 3];
    let worst = Math.abs(aa - ba);
    sum += worst;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a[i + c] * aa - b[i + c] * ba) / 255;
      sum += d;
      if (d > worst) worst = d;
    }
    map[p] = Math.round(worst);
    if (worst > threshold) over++;
    if (worst > max) max = worst;
  }
  return { mean: sum / a.length, over: over / pixels, max: Math.round(max), map };
}
