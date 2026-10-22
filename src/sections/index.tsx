import type { ComponentType } from 'react';
import type { SectionId } from '../layout/sections';
import { ExportSection } from './ExportSection';
import { FrameSection } from './FrameSection';
import { ImportSection } from './ImportSection';
import { SizeSection } from './SizeSection';

/** Sections that have been built. Others show their placeholder. */
export const SECTION_CONTENT: Partial<Record<SectionId, ComponentType>> = {
  import: ImportSection,
  frame: FrameSection,
  size: SizeSection,
  export: ExportSection,
};
