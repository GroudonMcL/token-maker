import type { ComponentType } from 'react';
import type { SectionId } from '../layout/sections';
import { BackgroundSection } from './BackgroundSection';
import { EffectsSection } from './EffectsSection';
import { ExportSection } from './ExportSection';
import { ForegroundSection } from './ForegroundSection';
import { FrameSection } from './FrameSection';
import { ImageSection } from './ImageSection';
import { ImportSection } from './ImportSection';
import { LightingSection } from './LightingSection';
import { PopOutSection } from './PopOutSection';
import { SizeSection } from './SizeSection';

/** Sections that have been built. Others show their placeholder. */
export const SECTION_CONTENT: Partial<Record<SectionId, ComponentType>> = {
  import: ImportSection,
  image: ImageSection,
  background: BackgroundSection,
  foreground: ForegroundSection,
  lighting: LightingSection,
  popout: PopOutSection,
  effects: EffectsSection,
  frame: FrameSection,
  size: SizeSection,
  export: ExportSection,
};
