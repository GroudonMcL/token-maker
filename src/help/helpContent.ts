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

/** A before → after picture in public/help/ (made by `npm run help-images`). */
const beforeAfter = (name: string, what: string): HelpMedia => ({
  kind: 'image',
  src: `/help/${name}.webp`,
  alt: `Before and after: ${what}`,
});

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

  // ---- Image (Phase 3) ----
  'image.brightness': {
    title: 'Brightness',
    text: 'Makes the whole picture lighter or darker.',
    media: beforeAfter('image-brightness', 'the goblin gets brighter'),
  },
  'image.contrast': {
    title: 'Contrast',
    text: 'Pushes light and dark parts further apart for a punchier look, or closer together for a softer one.',
    media: beforeAfter('image-contrast', 'the goblin gets punchier'),
  },
  'image.saturation': {
    title: 'Saturation',
    text: 'Makes colours stronger, or weaker down to black and white at -100.',
    media: beforeAfter('image-saturation', 'the colours get stronger'),
  },
  'image.advanced': {
    title: 'More adjustments',
    text: 'Fine-tune colour, light, detail and style. You never need these for a good token.',
    media: beforeAfter('image-advanced', 'a warmer, older look'),
  },
  'image.hue': {
    title: 'Hue',
    text: 'Shifts every colour around the colour wheel, for example to turn a green goblin blue.',
    media: beforeAfter('image-hue', 'the green goblin turns blue'),
  },
  'image.temperature': {
    title: 'Temperature',
    text: 'Warmer (more orange) or cooler (more blue), like daylight versus moonlight.',
    media: beforeAfter('image-temperature', 'the picture gets warmer'),
  },
  'image.tint': {
    title: 'Tint',
    text: 'Moves colours towards magenta or green, to fix a colour cast.',
    media: beforeAfter('image-tint', 'the picture shifts towards magenta'),
  },
  'image.exposure': {
    title: 'Exposure',
    text: 'Brightens or darkens like a camera does: the darkest parts stay dark.',
    media: beforeAfter('image-exposure', 'the picture gets brighter like a longer exposure'),
  },
  'image.highlights': {
    title: 'Highlights',
    text: 'Changes only the bright parts: lower it to bring back detail in a washed-out sky or armour.',
    media: beforeAfter('image-highlights', 'the bright sky gets darker'),
  },
  'image.shadows': {
    title: 'Shadows',
    text: 'Changes only the dark parts: raise it to see detail hidden in shadow.',
    media: beforeAfter('image-shadows', 'the dark parts get lighter'),
  },
  'image.sharpness': {
    title: 'Sharpness',
    text: 'Makes edges crisper, which helps small tokens read well on the map.',
    media: beforeAfter('image-sharpness', 'a soft picture gets crisper'),
  },
  'image.blur': {
    title: 'Blur',
    text: 'Softens the whole picture.',
    media: beforeAfter('image-blur', 'the picture gets softer'),
  },
  'image.vibrance': {
    title: 'Vibrance',
    text: 'Like Saturation, but boosts dull colours most, so bright colours and skin don’t go garish.',
    media: beforeAfter('image-vibrance', 'the dull colours get stronger'),
  },
  'image.grayscale': {
    title: 'Grayscale',
    text: 'Takes the colour out, part way or completely.',
    media: beforeAfter('image-grayscale', 'the colour is taken out'),
  },
  'image.sepia': {
    title: 'Sepia',
    text: 'Gives an old brown-photograph look.',
    media: beforeAfter('image-sepia', 'an old brown-photograph look'),
  },
  'image.invert': {
    title: 'Invert',
    text: 'Swaps every colour for its opposite, like a photo negative.',
    media: beforeAfter('image-invert', 'every colour swapped for its opposite'),
  },
  'image.removeBg': {
    title: 'Remove flat background',
    text: 'Makes a plain background around your character see-through. It works best on pictures with a single-colour background, and the picture itself is never changed.',
    media: beforeAfter('image-removeBg', 'the white background becomes see-through'),
  },
  'image.bgColour': {
    title: 'Background colour',
    text: 'The colour to remove, found automatically from the edges of the picture. Use Pick colour and tap the background if it chose the wrong one.',
    media: beforeAfter('image-bgColour', 'the white background colour is found and removed'),
  },
  'image.intensity': {
    title: 'Intensity',
    text: 'How different a colour can be from the background colour and still be removed. Raise it if bits of background are left; lower it if your character gets eaten away.',
    media: beforeAfter('image-intensity', 'leftover background specks are removed at a higher intensity'),
  },
  'image.softness': {
    title: 'Edge softness',
    text: 'Softens the cut-out edge so it blends in rather than looking jagged.',
    media: beforeAfter('image-softness', 'a hard cut-out edge becomes soft'),
  },
  'image.brush': {
    title: 'Erase / restore brush',
    text: 'Turn the brush on, then paint on the picture to erase parts or bring removed parts back. Two fingers still move and zoom the art, and each stroke can be undone.',
    media: beforeAfter('image-brush', 'a stroke of the erase brush'),
  },
  'image.brushMode': {
    title: 'Erase or restore',
    text: 'Erase makes what you paint see-through; Restore brings it back.',
    media: beforeAfter('image-brushMode', 'Restore brings back part of an erased stroke'),
  },
  'image.brushSize': {
    title: 'Brush size',
    text: 'How big the brush is on your screen. Zoom in on the art for fine detail.',
    media: beforeAfter('image-brushSize', 'a small brush and a big brush'),
  },
  'image.brushAdvanced': {
    title: 'Brush options',
    text: 'Softness, pen pressure and how removed parts are shown.',
    media: beforeAfter('image-brushAdvanced', 'a hard brush and a soft brush'),
  },
  'image.brushSoftness': {
    title: 'Brush softness',
    text: 'A soft brush fades out at its edge for smooth blends; 0% gives a hard edge.',
    media: beforeAfter('image-brushSoftness', 'a hard brush and a soft brush'),
  },
  'image.pressure': {
    title: 'Pen pressure',
    text: 'With a pen or stylus, pressing lightly paints a thinner line.',
    media: beforeAfter('image-pressure', 'pressing lightly at each end makes the line thinner'),
  },
  'image.showRemoved': {
    title: 'Show removed parts in red',
    text: 'While the brush is on, removed parts of the picture are tinted red so you can see what Restore would bring back.',
    media: beforeAfter('image-showRemoved', 'removed parts shown tinted red'),
  },

  // ---- Background (Phase 4) ----
  'background.kind': { title: 'Background', text: 'What fills the frame behind your art: nothing, a colour, a gradient or a picture.' },
  'background.color': { title: 'Background colour', text: 'One flat colour behind the art.' },
  'background.gradientType': { title: 'Gradient type', text: 'Linear runs from one side to the other; radial spreads out from the middle.' },
  'background.gradientAngle': { title: 'Angle', text: 'Which way a linear gradient runs: 0° goes left to right, 90° top to bottom.' },
  'background.gradientColors': { title: 'Gradient colours', text: 'The colours at the two ends. Advanced has every colour stop.' },
  'background.gradientStops': {
    title: 'Colour stops',
    text: 'Each stop is a colour at a point along the gradient, with its own opacity. Add stops for more colours; drag Position to move one.',
  },
  'background.source': {
    title: 'Picture from',
    text: "A built-in scene, a picture of your own (uploaded or from a link), or an enlarged copy of the token's own art.",
  },
  'background.library': { title: 'Built-in pictures', text: 'Scenes drawn for Token Maker, free to use on any token.' },
  'background.upload': { title: 'Your own background', text: 'Choose a picture from your device, or paste a link below. It only changes the background, not your art.' },
  'background.blur': {
    title: 'Blur',
    text: 'Softens the background picture so your art stands out. A blurred copy of the art itself makes a neat matching background.',
  },
  'background.zoom': { title: 'Zoom', text: 'Makes the background picture bigger or smaller, without changing the art.' },
  'background.move': { title: 'Move the background', text: 'Turn this on, then drag on the canvas to slide the background picture. Reset puts it back in the middle.' },
  'background.opacity': { title: 'Opacity', text: 'How solid the background is. Below 100% the backing colour shows through.' },

  // ---- Foreground (Phase 4) ----
  'foreground.add': {
    title: 'Add an overlay',
    text: 'Overlays are drawn over your art, inside the frame. Stack as many as you like; the top of the list is drawn last.',
  },
  'foreground.color': { title: 'Colour', text: "The overlay's colour." },
  'foreground.angle': { title: 'Side', text: 'Which side or corner of the token the overlay sits on.' },
  'foreground.size': { title: 'Reach', text: 'How far in from the edge it reaches, or how much of it there is.' },
  'foreground.softness': { title: 'Softness', text: 'How gently the overlay fades out.' },
  'foreground.scale': { title: 'Scale', text: 'The size of the leaves, smoke puffs, mist banks or webs.' },
  'foreground.opacity': { title: 'Opacity', text: 'How strong the overlay is.' },
  'foreground.blend': {
    title: 'Blend mode',
    text: 'How the overlay mixes with the art: Multiply darkens, Screen lightens, Overlay and Soft light add contrast and colour.',
  },
  'foreground.shuffle': { title: 'Shuffle', text: 'Rearranges the leaves, smoke or webs at random. Each layout is kept, so the token always looks the same.' },

  // ---- Lighting (Phase 4) ----
  'lighting.presets': {
    title: 'Lighting presets',
    text: 'Ready-made lights: Torchlight from below, Moonlight from above, and more. Pick one, then change anything you like.',
  },
  'lighting.enabled': { title: 'Light the art', text: 'Shines a coloured light on the art from one side, darkening the far side.' },
  'lighting.direction': {
    title: 'Light direction',
    text: 'Where the light comes from: drag the dot round the dial. Shadows fall away from it, even when the light is off.',
  },
  'lighting.color': { title: 'Light colour', text: 'Warm orange for torches and fire, cool blue for moonlight, green for fel magic.' },
  'lighting.strength': { title: 'Strength', text: 'How bright and coloured the light is.' },
  'lighting.falloff': { title: 'Darkness away from the light', text: 'How much darker the side facing away from the light gets.' },
  'lighting.rim': {
    title: 'Rim light',
    text: 'A thin bright edge on the side facing the light. It works best when the background has been removed.',
  },
  'lighting.rimStrength': { title: 'Rim strength', text: 'How bright the rim is.' },
  'lighting.rimWidth': { title: 'Rim width', text: 'How thick the rim is.' },
  'lighting.background': { title: 'Light the background too', text: 'Lights the background picture the same way, so the art and the scene match.' },

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
