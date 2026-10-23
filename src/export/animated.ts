// The place for animated exports (GIF, and maybe APNG or WebM) — a future
// feature (DESIGN.md §15), deliberately not built yet.
//
// How it will fit in:
//
// 1. Effects are already functions of time (`src/render/effectPainters.ts`
//    takes `time` in seconds, always 0 for now). Pass a time through
//    `RenderOptions` to `renderToken`, so one document can be drawn at any
//    moment of its animation.
// 2. Draw the token at each of `frameTimes()` (e.g. 2 s at 12 fps = 24
//    frames), one canvas at a time, as a batch export does with tokens
//    (render, hand over, `releaseCanvas`).
// 3. An encoder turns the frames into a file in a Web Worker, as
//    `zip.worker.ts` does for ZIPs (for GIF: a small palette-quantising
//    encoder, e.g. `gifenc`).
// 4. Add the format to `FORMATS` in `formats.ts` with `animated: true`, and
//    give the Export panel frame-rate and length controls for it.

/** Animated formats we expect to offer. None are built yet. */
export type AnimatedFormat = 'gif' | 'apng' | 'webm';

export interface AnimationOptions {
  /** Frames per second. */
  fps: number;
  /** Length of one loop, in seconds. */
  seconds: number;
}

/** The times (in seconds) of each frame in one loop. */
export function frameTimes({ fps, seconds }: AnimationOptions): number[] {
  const n = Math.max(1, Math.round(fps * seconds));
  return Array.from({ length: n }, (_, i) => i / fps);
}
