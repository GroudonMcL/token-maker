import type { RenderSource } from './render';

/**
 * A stand-in portrait (sky, hills and a figure) drawn by code, for the frame
 * sheet, frame tile thumbnails and tests.
 */
export function sampleArt(make: (w: number, h: number) => HTMLCanvasElement, size = 400): RenderSource {
  const canvas = make(size, size);
  const a = canvas.getContext('2d')!;
  const k = size / 400;
  a.scale(k, k);
  const sky = a.createLinearGradient(0, 0, 0, 400);
  sky.addColorStop(0, '#8fb4d8');
  sky.addColorStop(1, '#e8d6b0');
  a.fillStyle = sky;
  a.fillRect(0, 0, 400, 400);
  a.fillStyle = '#5c7a4a';
  a.beginPath();
  a.ellipse(200, 420, 320, 170, 0, 0, Math.PI * 2);
  a.fill();
  a.fillStyle = '#3b2a2a';
  a.beginPath();
  a.arc(200, 170, 60, 0, Math.PI * 2);
  a.fill();
  a.fillRect(130, 220, 140, 180);
  return { image: canvas, width: size, height: size };
}
