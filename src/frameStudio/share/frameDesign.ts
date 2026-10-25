// What Token Maker needs to use a Frame Studio design as a frame (DESIGN.md
// §10): read a .framestudio.json file and draw the design on Token Maker's
// own band. This folder, src/project/ and src/render/ are copied into
// token-maker by `npm run share:export` (scripts/share-export.ts), so both
// apps read and draw designs with the same code.

import type { FrameGeometry } from '../../render/frameKit';
import { parseProject, type ParseResult } from '../project/migrate';
import type { FrameProject } from '../project/types';
import type { Ctx } from '../render/canvas';
import { renderProject } from '../render/renderProject';

export { PROJECT_FORMAT, SCHEMA_VERSION } from '../project/types';
export type { FrameProject } from '../project/types';
export type { ParseResult } from '../project/migrate';
export { PROJECT_EXTENSION } from '../project/transfer';
/**
 * Loads the photo textures a design uses. Call it (and wait) before
 * drawFrameDesign; a picture not loaded yet is drawn as its average colour.
 */
export { loadPictures as loadFrameDesignPictures } from '../render/pictures';

/**
 * Reads a design from a file's text, or from the object a token document
 * keeps (any version Frame Studio has saved; never runs anything in it).
 */
export function readFrameDesign(input: string | object): ParseResult {
  return parseProject(input);
}

/** The preview picture saved in the file (Export → Project file with a preview), as a PNG data URL, if there is one. */
export function previewOf(text: string): string | null {
  try {
    const raw = JSON.parse(text) as { preview?: unknown };
    return typeof raw.preview === 'string' && raw.preview.startsWith('data:image/png;base64,') ? raw.preview : null;
  } catch {
    return null;
  }
}

/**
 * Draws a design as a token's frame, on the band Token Maker gives (the same
 * FrameGeometry its drawFrame takes): the context's origin is the token's
 * centre, `g.R` its half-size and `g.outer` / `g.inner` the band's edges in
 * pixels in from the token's edge. The design follows that band, its shape
 * and thickness, exactly as it follows the stage in Frame Studio; it is lit
 * from the design's own light. Nothing under the frame is cleared.
 */
export function drawFrameDesign(ctx: Ctx, project: FrameProject, g: Pick<FrameGeometry, 'shape' | 'R' | 'outer' | 'inner'>, options: { cache?: boolean } = {}): void {
  const size = Math.round(g.R * 2);
  ctx.save();
  ctx.translate(-size / 2, -size / 2);
  renderProject(ctx, { ...project, stage: { ...project.stage, shape: g.shape, showArt: false } }, size, {
    band: { shape: g.shape, outer: g.outer, inner: g.inner },
    clear: false,
    cache: options.cache,
  });
  ctx.restore();
}
