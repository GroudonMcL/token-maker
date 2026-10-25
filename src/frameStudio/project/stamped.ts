// Token Maker's Stamped colours (engine/legacy/frames.ts, which can't be
// imported from): the outer band's and the inner step's colours round the
// ring, and its texture's light colours, all for its own orange. Used by the
// Stamped conversion and by the Veined marble texture, which keeps to the
// side these colours leave dark.

import { recolour } from '../../render/color';
import type { RingStop } from './types';

export const STAMPED_BASE = '#d7671f';

/** Angle (degrees, 0 = right, 90 = down) → colour. */
export const STAMPED_OUTER: [number, string][] = [
  [0, '#2f0f03'], [15, '#260d05'], [30, '#1b0602'], [45, '#170300'], [60, '#190502'], [75, '#1e0902'],
  [90, '#250902'], [105, '#230701'], [120, '#400f02'], [135, '#7a1f03'], [150, '#da4103'], [165, '#ff6c08'],
  [180, '#feaa29'], [195, '#feee5f'], [210, '#ffff89'], [225, '#ffff97'], [240, '#ffff9e'], [255, '#ffff99'],
  [270, '#fffc83'], [285, '#ffce54'], [300, '#fe701f'], [315, '#ac3a07'], [330, '#6c2304'], [345, '#300c01'],
];
export const STAMPED_STEP: [number, string][] = [
  [0, '#b42d03'], [15, '#a02a09'], [30, '#862108'], [45, '#5e1104'], [60, '#4b0b03'], [75, '#5d1204'],
  [90, '#811d04'], [105, '#661303'], [120, '#5d1201'], [135, '#671b02'], [150, '#611e02'], [165, '#672605'],
  [180, '#6c2f0b'], [195, '#6e401f'], [210, '#6f4b2a'], [225, '#6a4e2c'], [240, '#6e5135'], [255, '#6d4d32'],
  [270, '#775032'], [285, '#794421'], [300, '#a0470e'], [315, '#b73d06'], [330, '#c53502'], [345, '#b72f03'],
];
export const STAMPED_MARBLE_LIGHT = '#ff500a';
export const STAMPED_VEIN_LIGHT = '#ff7832';
export const STAMPED_FLECK_LIGHT = '#ff8c46';

/** Stamped's colours moved to another colour, as Token Maker recolours them. */
export const stampedColour = (hex: string, color: string) => recolour(hex, STAMPED_BASE, color);

/** A Stamped colour table as ring-paint stops in another colour. */
export const stampedStops = (table: [number, string][], color: string): RingStop[] => table.map(([angle, c]) => ({ angle, color: stampedColour(c, color) }));
