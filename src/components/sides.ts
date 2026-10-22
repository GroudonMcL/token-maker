const SIDES = ['right', 'bottom right', 'below', 'bottom left', 'left', 'top left', 'above', 'top right'];

/** "below", "top left"… for a direction in degrees (0 = right, 90 = below). */
export function sideName(deg: number): string {
  return SIDES[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;
}
