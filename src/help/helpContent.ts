import type { HelpPreview } from './BeforeAfter';

/**
 * Every "?" help tip in the app (DESIGN.md §11), keyed by control id.
 * To change what a tip says, edit it here. A test fails if a control on
 * screen points at an id that is missing from this list.
 *
 * `media` is optional: a small before/after picture or short looping clip
 * kept in /public/help/. Clips should have a `poster` still for people who
 * prefer reduced motion.
 */
export interface HelpMedia {
  kind: 'image' | 'video';
  src: string;
  alt: string;
  poster?: string;
}

export interface HelpEntry {
  title: string;
  text: string;
  media?: HelpMedia;
  /** A before/after picture drawn live by the image code (see BeforeAfter.tsx). */
  preview?: HelpPreview;
}

export const helpContent = {
  // ---- Panel sections (DESIGN.md §8, in order) ----
  'section.import': {
    title: 'Import',
    text: 'Bring in a picture: upload a file, drag it onto the page, paste it, or paste a web or Pinterest link.',
  },
  'section.image': {
    title: 'Image',
    text: 'Adjust brightness, contrast and colour, remove a flat background, and fix the edges with the erase/restore brush.',
  },
  'section.background': {
    title: 'Background',
    text: 'What shows behind your art inside the frame: a colour, a gradient or an image (including a blurred copy of your art).',
  },
  'section.foreground': {
    title: 'Foreground',
    text: 'Layers drawn over your art but inside the frame, like a vignette, mist or foliage.',
  },
  'section.lighting': {
    title: 'Lighting & shadows',
    text: 'Light your art from one direction and set the shadows the token casts. Shadows follow the light unless you unlink them.',
  },
  'section.popout': {
    title: 'Pop-out',
    text: 'Paint over parts of the art, like a head or a sword, so they are drawn on top of the border.',
  },
  'section.effects': {
    title: 'Effects',
    text: 'Stack glows, elemental effects, condition looks and atmosphere. Each one can sit behind the art, over it, or on the border.',
  },
  'section.frame': {
    title: 'Frame & shape',
    text: 'Choose the token shape and border style, then set its colour, thickness and spacing.',
  },
  'section.decorations': {
    title: 'Decorations',
    text: 'Add gems, skulls, horns, wings and more around the border. They can snap to set points and mirror left/right.',
  },
  'section.size': {
    title: 'Size',
    text: 'How many grid squares the creature covers on the map. Borders and labels stay the same thickness on the map at every size.',
  },
  'section.label': {
    title: 'Label',
    text: 'Add a name on a banner, plaque or pill, or curve it around the ring.',
  },
  'section.presets': {
    title: 'Presets',
    text: 'Apply a ready-made style, save your own, or share a style as a small file. Presets never include your art.',
  },
  'section.export': {
    title: 'Export',
    text: 'Download the token as PNG, WebP or JPG at the size your virtual tabletop needs, or copy it to the clipboard.',
  },

  // ---- Import ----
  'import.upload': {
    title: 'Upload an image',
    text: 'Choose a picture from your device. You can also drag one anywhere onto the page, or paste it with Ctrl+V (long-press and Paste on a phone).',
  },
  'import.name': {
    title: 'Token name',
    text: "Used for the downloaded file's name. It is filled in from the image's file name, and you can change it.",
  },

  // ---- Image (Phase 3) ----
  'image.brightness': { title: 'Brightness', text: 'Make the whole picture lighter or darker.', preview: { adjust: { brightness: 45 } } },
  'image.contrast': { title: 'Contrast', text: 'Push the light and dark parts further apart for punch, or closer together for a softer look.', preview: { adjust: { contrast: 60 } } },
  'image.saturation': { title: 'Saturation', text: 'Make every colour stronger, or weaker all the way down to grey.', preview: { adjust: { saturation: 80 } } },
  'image.hue': { title: 'Hue', text: 'Shift every colour around the colour wheel, for example to turn a green goblin blue.', preview: { adjust: { hue: 120 } } },
  'image.temperature': { title: 'Temperature', text: 'Warm the picture towards orange, or cool it towards blue.', preview: { adjust: { temperature: 70 } } },
  'image.tint': { title: 'Tint', text: 'Shift the colours towards magenta, or towards green.', preview: { adjust: { tint: 70 } } },
  'image.exposure': { title: 'Exposure', text: 'Like letting more or less light into a camera: up to two stops brighter or darker.', preview: { adjust: { exposure: 60 } } },
  'image.highlights': { title: 'Highlights', text: 'Brighten or tone down only the light parts, for example to recover a bright sky.', preview: { adjust: { highlights: -100 } } },
  'image.shadows': { title: 'Shadows', text: 'Lift or deepen only the dark parts, for example to see a face in shade.', preview: { adjust: { shadows: 100 } } },
  'image.sharpness': { title: 'Sharpness', text: 'Make edges crisper, which helps small tokens read on the map.', preview: { adjust: { sharpness: 100 } } },
  'image.blur': { title: 'Blur', text: 'Soften the whole picture.', preview: { adjust: { blur: 50 } } },
  'image.vibrance': { title: 'Vibrance', text: 'A gentler saturation: it boosts dull colours more than ones that are already strong.', preview: { adjust: { vibrance: 100 } } },
  'image.grayscale': { title: 'Grayscale', text: 'Fade the colour out, towards black and white.', preview: { adjust: { grayscale: 100 } } },
  'image.sepia': { title: 'Sepia', text: 'An old-photograph brown tone.', preview: { adjust: { sepia: 100 } } },
  'image.invert': { title: 'Invert', text: 'Swap every colour for its opposite, like a photo negative.', preview: { adjust: { invert: true } } },
  'image.reset': { title: 'Reset adjustments', text: 'Put every slider in this section back to its default. You can undo this.' },
  'removal.enabled': {
    title: 'Remove background',
    text: 'Makes a flat, single-colour background see-through. It only hides pixels, so you can turn it off or fix it with the brush at any time.',
    preview: { removal: {} },
  },
  'removal.color': {
    title: 'Background colour',
    text: 'The colour being removed. Auto finds it from the picture\'s edges; the eyedropper lets you click it, which also clears enclosed areas of it.',
    preview: { removal: {} },
  },
  'removal.intensity': {
    title: 'Intensity',
    text: 'How different a colour can be from the background and still be removed. Raise it for shaded backgrounds; lower it if parts of your subject vanish.',
    preview: { removal: { intensity: 40 } },
  },
  'removal.softness': {
    title: 'Edge softness',
    text: 'How gently the cut edge fades out. Softer edges hide jagged pixels and leftover background colour.',
    preview: { removal: { softness: 100 } },
  },
  'brush.tool': {
    title: 'Erase / restore brush',
    text: 'Paint on the token to hide parts of the picture (Erase) or bring them back (Restore). Hidden parts show faintly and the frame fades while you paint.',
    preview: { brush: 'erase' },
  },
  'brush.erase': { title: 'Erase', text: 'Paint to hide leftover background or anything else you don\'t want.', preview: { brush: 'erase' } },
  'brush.restore': { title: 'Restore', text: 'Paint to bring back parts that were removed by mistake.', preview: { brush: 'restore' } },
  'brush.simple': { title: 'Simple brush', text: 'One slider for the brush size, with a medium-soft edge. Turn it off to set the softness too.' },
  'brush.size': {
    title: 'Brush size',
    text: 'How big the brush is on screen (shortcut: [ and ]). Zoom the view in, by scrolling over the token or pinching with two fingers, for finer detail.',
  },
  'brush.softness': { title: 'Brush softness', text: 'Hard brushes make crisp edges; soft ones blend in. A pen also makes thinner lines when pressed lightly.' },
  'brush.clear': { title: 'Clear brush strokes', text: 'Remove every erase and restore stroke from this picture. You can undo this.' },

  // ---- Frame & shape ----
  'frame.shape': { title: 'Shape', text: 'The outline of the token. Hexagons suit hex-grid maps.' },
  'frame.style': {
    title: 'Frame',
    text: 'The border drawn around the art. Every frame takes any colour, thickness and spacing.',
  },
  'frame.color': {
    title: 'Frame colour',
    text: "The frame's main colour. Lighting, texture and ornaments are recoloured to match.",
  },
  'frame.thickness': {
    title: 'Thickness',
    text: 'How wide the border is, as a share of one grid square, so it looks the same on the map at every creature size.',
  },
  'frame.highlight': {
    title: 'Frame highlights colour',
    text: 'Some frames have details in a colour of their own, like the jade beads on Monk or the eyes on Warlock. Change those here.',
  },
  'frame.outerSpacing': {
    title: 'Outer spacing',
    text: 'Empty space between the edge of the image and the frame, which leaves room for the drop shadow.',
  },
  'frame.innerSpacing': {
    title: 'Inner spacing',
    text: 'A gap between the frame and the art, filled with the backing colour.',
  },
  'frame.backingColor': {
    title: 'Backing colour',
    text: 'The colour behind the art. It shows through the inner spacing and any transparent parts of the picture.',
  },
  'frame.backingOpacity': { title: 'Backing opacity', text: 'Set to 0% for no backing, so transparent parts of the art stay see-through.' },

  // ---- Size ----
  'size.preset': {
    title: 'Creature size',
    text: 'How many grid squares the creature covers: Tiny is half a square, Large is 2 × 2, Huge 3 × 3 and Gargantuan 4 × 4.',
  },
  'size.custom': { title: 'Squares', text: 'Any number of squares across, in half-square steps.' },

  // ---- Export ----
  'export.download': {
    title: 'Download PNG',
    text: 'Saves the token as a PNG with a transparent background at 256 pixels per grid square. More formats and sizes are coming.',
  },

  // ---- Canvas ----
  'canvas.stage': {
    title: 'Editing the art',
    text: 'Drag to move the art, use the corner handles to resize it and the round handle to rotate it (or pinch and twist with two fingers). Scroll over the token to zoom the view in for a closer look, and hold Space or the middle mouse button and drag to look around.',
  },

  // ---- Top bar ----
  'topbar.batch': {
    title: 'Batch mode',
    text: 'Make several tokens at once with one shared style. Each image keeps its own position and name, and you export them all as a ZIP.',
  },
  'topbar.theme': {
    title: 'Theme',
    text: 'Switch between the dark and light look. "System" follows your device setting.',
  },

  // ---- Floating canvas toolbar ----
  'toolbar.zoom': {
    title: 'Zoom',
    text: 'Make the art bigger or smaller inside the frame. You can also drag the corner handles or pinch with two fingers.',
  },
  'toolbar.rotate': { title: 'Rotate', text: 'Turn the art a quarter turn clockwise. Use the round handle on the canvas, or two fingers, for any angle.' },
  'toolbar.flip': { title: 'Flip sideways', text: 'Mirror the art left to right, so the creature faces the other way.' },
  'toolbar.flipV': { title: 'Flip upside down', text: 'Mirror the art top to bottom.' },
  'toolbar.reset': { title: 'Reset', text: 'Put the art back to how it was first placed: centred, unrotated and filling the frame.' },
  'toolbar.fit': { title: 'Fit', text: 'Shrink the art so all of it is visible inside the frame.' },
  'toolbar.fill': { title: 'Fill', text: 'Enlarge the art so it covers the whole inside of the frame with no gaps.' },

  // ---- Shared component examples (UI kit page) ----
  'kit.slider': {
    title: 'Slider',
    text: 'Drag the handle, use the arrow keys, or type an exact number in the box. A whole drag is one undo step.',
  },
  'kit.advanced': {
    title: 'Advanced',
    text: 'Extra fine-tuning controls. You never need these for a good-looking token.',
  },
  'kit.swatches': {
    title: 'Colour',
    text: 'Pick a ready-made colour or choose any colour with the picker. You can also type a hex code like #d6a24e.',
  },
  'kit.segmented': { title: 'Shape', text: 'Choose one option. Use the arrow keys to move between them.' },
  'kit.tiles': { title: 'Frame style', text: 'Pick a tile. Every frame takes any colour, thickness and spacing.' },
  'kit.strip': { title: 'Images on the page', text: 'Pick the image you want to use. Tiny icons are hidden.' },
  'kit.toggle': { title: 'Toggle', text: 'Turns a setting on or off.' },
} satisfies Record<string, HelpEntry>;

export type HelpId = keyof typeof helpContent;

export function getHelp(id: HelpId): HelpEntry {
  return helpContent[id];
}
