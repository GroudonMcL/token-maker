// Opening Frame Studio designs and using them as the token's frame
// (DESIGN.md §6.12). A design is read by Frame Studio's own reader, kept in
// this browser's design library, and copied into the document.

import type { DesignFrame } from '../document/types';
import { readFrameDesign, type FrameProject } from '../frameStudio/share/frameDesign';
import { saveDesign } from '../state/designLibrary';
import { toast } from '../ui/toast';
import { updateFrameAndArt } from './artActions';

/** Design files bigger than this aren't read. */
const MAX_DESIGN_BYTES = 5_000_000;

/** Uses a design as the frame (one undo step). The band keeps the token's thickness and spacing. */
export function applyDesignFrame(id: string, name: string, project: FrameProject): void {
  const design: DesignFrame = { id, name, project };
  updateFrameAndArt((d) => ({ ...d, frame: { ...d.frame, kind: 'design', design } }));
}

/** Reads a .framestudio.json file, keeps it in the design library and uses it as the frame. */
export async function openDesignFile(file: File): Promise<boolean> {
  if (file.size > MAX_DESIGN_BYTES) {
    toast("That file is too big to be a Frame Studio design.", 'error');
    return false;
  }
  const text = await file.text();
  const result = readFrameDesign(text);
  if (!result.ok) {
    toast(result.error.replace('project file', 'design'), 'error');
    return false;
  }
  const id = await saveDesign(text, result.project.name);
  applyDesignFrame(id, result.project.name, result.project);
  toast(result.warnings.length ? `Opened "${result.project.name}". ${result.warnings.join(' ')}` : `Opened "${result.project.name}" as the frame.`);
  return true;
}
