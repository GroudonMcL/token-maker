// Colour adjustments (DESIGN.md §6.2), as plain pixel maths so they look the
// same in every browser (canvas `filter` is missing in Safari), in a Web
// Worker and in tests. Brightness, contrast and saturation use the
// extension's formulas, so its tokens look the same here.

import type { ImageAdjustments } from '../document/types';

export interface PixelBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Adjustments that work pixel by pixel (blur and sharpness are in filters.ts). */
const COLOUR_KEYS = [
  'brightness',
  'contrast',
  'saturation',
  'hue',
  'temperature',
  'tint',
  'exposure',
  'highlights',
  'shadows',
  'vibrance',
  'grayscale',
  'sepia',
] as const;

export function hasColourAdjustments(a: ImageAdjustments): boolean {
  return a.invert || COLOUR_KEYS.some((k) => a[k] !== 0);
}

// sRGB ↔ linear light, for exposure (which works like a camera's: in stops).
const TO_LINEAR = new Float32Array(256);
for (let v = 0; v < 256; v++) {
  const c = v / 255;
  TO_LINEAR[v] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const LIN_STEPS = 4096;
const FROM_LINEAR = new Float32Array(LIN_STEPS + 1);
for (let i = 0; i <= LIN_STEPS; i++) {
  const c = i / LIN_STEPS;
  FROM_LINEAR[i] = 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
}

/** The CSS hue-rotate matrix. */
function hueMatrix(degrees: number): number[] {
  const a = (degrees * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Applies the colour adjustments in place, in this order: exposure,
 * brightness/contrast, highlights/shadows, temperature/tint, hue,
 * saturation, vibrance, sepia, grayscale, invert.
 */
export function adjustColours(buffer: PixelBuffer, a: ImageAdjustments): void {
  if (!hasColourAdjustments(a)) return;
  const d = buffer.data;

  const gain = 2 ** (a.exposure / 50); // ±2 stops
  const bright = (a.brightness / 100) * 255 * 0.5;
  const c = (a.contrast / 100) * 255 * 0.9;
  const contrast = (259 * (c + 255)) / (255 * (259 - c));
  const doBC = a.brightness !== 0 || a.contrast !== 0;
  const sh = (a.shadows / 100) * 0.5 * 255;
  const hl = (a.highlights / 100) * 0.5 * 255;
  const warm = (a.temperature / 100) * 30;
  const tint = (a.tint / 100) * 30;
  const m = a.hue !== 0 ? hueMatrix(a.hue) : null;
  const sat = 1 + a.saturation / 100;
  const vib = a.vibrance / 100;
  const sepia = a.sepia / 100;
  const gray = a.grayscale / 100;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]!;
    let g = d[i + 1]!;
    let b = d[i + 2]!;

    if (gain !== 1) {
      r = FROM_LINEAR[Math.min(LIN_STEPS, Math.round(TO_LINEAR[r]! * gain * LIN_STEPS))]!;
      g = FROM_LINEAR[Math.min(LIN_STEPS, Math.round(TO_LINEAR[g]! * gain * LIN_STEPS))]!;
      b = FROM_LINEAR[Math.min(LIN_STEPS, Math.round(TO_LINEAR[b]! * gain * LIN_STEPS))]!;
    }
    if (doBC) {
      r = contrast * (r + bright - 128) + 128;
      g = contrast * (g + bright - 128) + 128;
      b = contrast * (b + bright - 128) + 128;
    }
    if (sh !== 0 || hl !== 0) {
      // Shadows move the dark tones, highlights the bright ones.
      const L = clamp255(0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const delta = sh * (1 - L) * (1 - L) + hl * L * L;
      r += delta;
      g += delta;
      b += delta;
    }
    if (warm !== 0 || tint !== 0) {
      r += warm + tint / 2;
      g -= tint;
      b += -warm + tint / 2;
    }
    if (m) {
      const r0 = r;
      const g0 = g;
      r = m[0]! * r0 + m[1]! * g0 + m[2]! * b;
      g = m[3]! * r0 + m[4]! * g0 + m[5]! * b;
      b = m[6]! * r0 + m[7]! * g0 + m[8]! * b;
    }
    if (sat !== 1) {
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      r = y + (r - y) * sat;
      g = y + (g - y) * sat;
      b = y + (b - y) * sat;
    }
    if (vib !== 0) {
      // Like saturation, but mostly on dull colours, so skin and bright colours don't go garish.
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const amount = 1 + vib * (1 - clamp255(max - min) / 255) * (vib > 0 ? 1.5 : 1);
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      r = y + (r - y) * amount;
      g = y + (g - y) * amount;
      b = y + (b - y) * amount;
    }
    if (sepia !== 0) {
      const sr = 0.393 * r + 0.769 * g + 0.189 * b;
      const sg = 0.349 * r + 0.686 * g + 0.168 * b;
      const sb = 0.272 * r + 0.534 * g + 0.131 * b;
      r += (sr - r) * sepia;
      g += (sg - g) * sepia;
      b += (sb - b) * sepia;
    }
    if (gray !== 0) {
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r += (y - r) * gray;
      g += (y - g) * gray;
      b += (y - b) * gray;
    }
    if (a.invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }
    d[i] = r; // Uint8ClampedArray rounds and clamps
    d[i + 1] = g;
    d[i + 2] = b;
  }
}
