// Where off-screen canvases come from: the browser's by default, @napi-rs/canvas
// in tests and scripts (as in token-maker's src/image/processedArt.ts).

export type Ctx = CanvasRenderingContext2D;
export type CanvasLike = HTMLCanvasElement | OffscreenCanvas;

let factory: (w: number, h: number) => CanvasLike = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

export function setCanvasFactory(make: (w: number, h: number) => CanvasLike): void {
  factory = make;
}

export function newCanvas(w: number, h: number): CanvasLike {
  return factory(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

export const context2d = (c: CanvasLike) => c.getContext('2d') as unknown as Ctx;
