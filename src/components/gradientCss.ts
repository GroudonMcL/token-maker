import type { Gradient } from '../document/types';
import { rgba } from '../render/color';

/** CSS for a preview of the gradient, left to right (or round, for radial). */
export function gradientCss(g: Gradient): string {
  const stops = g.stops.map((s) => `${rgba(s.color, s.opacity)} ${Math.round(s.offset * 100)}%`).join(', ');
  return g.type === 'radial' ? `radial-gradient(circle, ${stops})` : `linear-gradient(${g.angle + 90}deg, ${stops})`;
}
