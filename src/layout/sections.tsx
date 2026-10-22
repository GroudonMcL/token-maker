import type { ReactNode } from 'react';
import {
  Download,
  Frame,
  Gem,
  ImagePlus,
  Layers,
  Maximize2,
  Mountain,
  Ruler,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Tag,
  WandSparkles,
  Bookmark,
} from 'lucide-react';
import type { HelpId } from '../help/helpContent';

/** Panel sections, in the order of DESIGN.md §8. */
export type SectionId =
  | 'import'
  | 'image'
  | 'background'
  | 'foreground'
  | 'lighting'
  | 'popout'
  | 'effects'
  | 'frame'
  | 'decorations'
  | 'size'
  | 'label'
  | 'presets'
  | 'export';

export interface SectionDef {
  id: SectionId;
  title: string;
  helpId: HelpId;
  icon: ReactNode;
  /** One line shown in the empty placeholder until the section is built. */
  placeholder: string;
}

const icon = (C: typeof Download) => <C size={18} strokeWidth={1.75} />;

export const SECTIONS: readonly SectionDef[] = [
  { id: 'import', title: 'Import', helpId: 'section.import', icon: icon(ImagePlus), placeholder: 'Upload, drop, paste or link an image.' },
  { id: 'image', title: 'Image', helpId: 'section.image', icon: icon(SlidersHorizontal), placeholder: 'Adjustments, background removal and the erase/restore brush.' },
  { id: 'background', title: 'Background', helpId: 'section.background', icon: icon(Mountain), placeholder: 'Colour, gradient or image behind the art.' },
  { id: 'foreground', title: 'Foreground', helpId: 'section.foreground', icon: icon(Layers), placeholder: 'Vignette, mist, foliage and other overlays.' },
  { id: 'lighting', title: 'Lighting & shadows', helpId: 'section.lighting', icon: icon(Sun), placeholder: 'Light direction, presets and shadows.' },
  { id: 'popout', title: 'Pop-out', helpId: 'section.popout', icon: icon(Maximize2), placeholder: 'Paint parts of the art over the border.' },
  { id: 'effects', title: 'Effects', helpId: 'section.effects', icon: icon(Sparkles), placeholder: 'Glows, elements, conditions and atmosphere.' },
  { id: 'frame', title: 'Frame & shape', helpId: 'section.frame', icon: icon(Frame), placeholder: 'Shape, border style, colour and thickness.' },
  { id: 'decorations', title: 'Decorations', helpId: 'section.decorations', icon: icon(Gem), placeholder: 'Gems, skulls, horns, wings and more.' },
  { id: 'size', title: 'Size', helpId: 'section.size', icon: icon(Ruler), placeholder: 'Tiny to Gargantuan, or a custom number of squares.' },
  { id: 'label', title: 'Label', helpId: 'section.label', icon: icon(Tag), placeholder: 'Name banners, plaques and ring text.' },
  { id: 'presets', title: 'Presets', helpId: 'section.presets', icon: icon(Bookmark), placeholder: 'Built-in styles, your saved styles and sharing.' },
  { id: 'export', title: 'Export', helpId: 'section.export', icon: icon(Download), placeholder: 'Format, resolution, download and copy.' },
];

/**
 * Phone bottom-sheet tabs (DESIGN.md §8). The design lists ten tabs for
 * thirteen sections, so a few tabs hold more than one section.
 */
export interface PhoneTab {
  id: string;
  label: string;
  icon: ReactNode;
  sections: SectionId[];
}

export const PHONE_TABS: readonly PhoneTab[] = [
  { id: 'import', label: 'Import', icon: icon(ImagePlus), sections: ['import'] },
  { id: 'image', label: 'Image', icon: icon(SlidersHorizontal), sections: ['image', 'popout'] },
  { id: 'background', label: 'Backgr.', icon: icon(Mountain), sections: ['background'] },
  { id: 'foreground', label: 'Foregr.', icon: icon(Layers), sections: ['foreground'] },
  { id: 'lighting', label: 'Lighting', icon: icon(Sun), sections: ['lighting'] },
  { id: 'effects', label: 'Effects', icon: icon(WandSparkles), sections: ['effects'] },
  { id: 'frame', label: 'Frame', icon: icon(Frame), sections: ['frame', 'size', 'presets'] },
  { id: 'decor', label: 'Decor', icon: icon(Gem), sections: ['decorations'] },
  { id: 'label', label: 'Label', icon: icon(Tag), sections: ['label'] },
  { id: 'export', label: 'Export', icon: icon(Download), sections: ['export'] },
];

export const sectionById = (id: SectionId) => SECTIONS.find((s) => s.id === id)!;
