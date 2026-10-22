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
  'import.web': {
    title: 'Web address',
    text: 'Paste a link to a picture, a web page or a Pinterest pin and press Get. A page shows its pictures so you can pick one; you can also paste or drag a link anywhere on the page.',
  },
  'import.pagePictures': {
    title: 'Pictures on the page',
    text: 'Pick the picture to use for your token. Tiny icons are hidden, and you can pick a different one at any time.',
  },
  'import.name': {
    title: 'Token name',
    text: "Used for the downloaded file's name. It is filled in from the image's file name, and you can change it.",
  },

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
  'frame.opacity': { title: 'Frame opacity', text: 'Make the frame see-through. 100% is solid.' },
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
    text: 'Drag to move the art, scroll or pinch to zoom, and twist two fingers to rotate. The corner handles resize it and the round handle above it rotates it.',
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
    text: 'Make the art bigger or smaller inside the frame. You can also scroll the mouse wheel or pinch with two fingers.',
  },
  'toolbar.rotate': { title: 'Rotate', text: 'Turn the art a quarter turn clockwise. Use the round handle on the canvas, or two fingers, for any angle.' },
  'toolbar.flip': { title: 'Flip sideways', text: 'Mirror the art left to right, so the creature faces the other way.' },
  'toolbar.flipV': { title: 'Flip upside down', text: 'Mirror the art top to bottom.' },
  'toolbar.reset': { title: 'Reset', text: 'Put the art back to how it was first placed: centred, unrotated and filling the frame.' },
  'toolbar.fit': { title: 'Fit', text: 'Shrink the art so all of it is visible inside the frame.' },
  'toolbar.fill': { title: 'Fill', text: 'Enlarge the art so it covers the whole inside of the frame with no gaps.' },
  'toolbar.lock': {
    title: 'Keep the frame filled',
    text: 'When on, the art can never be moved or zoomed so far that an empty gap shows inside the frame.',
  },

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
