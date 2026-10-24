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
    media: beforeAfter('section-import', 'an empty token gets a goblin picture'),
  },
  'section.image': {
    title: 'Image',
    text: 'Adjust brightness, contrast and colour, and fix the edges with the erase/restore brush.',
    media: beforeAfter('section-image', 'the picture gets punchier, warmer colours'),
  },
  'section.background': {
    title: 'Background',
    text: "Remove the picture's own background (by its colour or with AI), then choose what shows behind your art: a colour, a gradient or an image.",
    media: beforeAfter('section-background', 'a forest appears behind the goblin'),
  },
  'section.lighting': {
    title: 'Lighting & shadows',
    text: 'Light your art from one direction and set the shadows the token casts. Shadows follow the light unless you unlink them.',
    media: beforeAfter('section-lighting', 'torchlight shines on the goblin from below'),
  },
  'section.popout': {
    title: 'Pop-out',
    text: 'Paint over parts of the art, like horns, a head or a sword, so they are drawn on top of the border. They stay inside the square image, and cast a shadow onto the frame.',
    media: beforeAfter('section-popout', 'the goblin\'s ears break out over the frame'),
  },
  'section.effects': {
    title: 'Effects',
    text: 'Stack glows, elemental effects, condition looks, atmosphere, overlays and pictures. Each one can sit behind the art, over it, or on the border.',
    media: beforeAfter('section-effects', 'fire and embers surround the token'),
  },
  'section.frame': {
    title: 'Frame & shape',
    text: 'Choose a frame drawn in any colour and thickness, or a picture frame (built in or your own PNG), and the token shape.',
    media: beforeAfter('section-frame', 'a round orange frame becomes a blue wizard hexagon'),
  },
  'section.decorations': {
    title: 'Decorations',
    text: 'Add gems, skulls, horns, wings and more around the border. They can snap to set points and mirror left/right.',
    media: beforeAfter('section-decorations', 'horns and a gem are added round the frame'),
  },
  'section.size': {
    title: 'Size',
    text: 'How many grid squares the creature covers on the map. Borders and labels stay the same thickness on the map at every size.',
    media: beforeAfter('section-size', 'a one-square token becomes a Large token covering four squares'),
  },
  'section.label': {
    title: 'Label',
    text: 'Add a name on a banner, plaque or pill, or curve it around the ring.',
    media: beforeAfter('section-label', 'the goblin\'s name appears on a banner'),
  },
  'section.presets': {
    title: 'Presets',
    text: 'Apply a ready-made style, save your own, or share a style as a small file or a text code. Presets never include your art.',
    media: beforeAfter('section-presets', 'one tap gives the token the Boss look'),
  },
  'section.export': {
    title: 'Export',
    text: 'Download the token as PNG or WebP at the size your virtual tabletop needs, or copy it to the clipboard.',
    media: beforeAfter('section-export', 'the finished token sits on a map grid'),
  },

  // ---- Import ----
  'import.upload': {
    title: 'Upload an image',
    text: 'Choose a picture from your device. You can also drag one anywhere onto the page, or paste it with Ctrl+V (long-press and Paste on a phone).',
    media: beforeAfter('import-upload', 'an empty token gets a goblin picture'),
  },
  'import.web': {
    title: 'Web address',
    text: 'Paste a link to a picture, a web page or a Pinterest pin and press Get. A page shows its pictures so you can pick one; you can also paste or drag a link anywhere on the page.',
    media: beforeAfter('import-web', 'an empty token gets a picture from a link'),
  },
  'import.pagePictures': {
    title: 'Pictures on the page',
    text: 'Pick the picture to use for your token. Tiny icons are hidden, and you can pick a different one at any time.',
    media: beforeAfter('import-pagePictures', 'picking one picture from a page makes the token'),
  },
  'import.name': {
    title: 'Token name',
    text: "Used for the downloaded file's name. It is filled in from the image's file name, and you can change it.",
    media: beforeAfter('import-name', 'the label changes from Untitled token to Goblin Scout'),
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
    title: 'Remove background',
    text: 'Makes the background around your character see-through, by its flat colour or with AI. The picture itself is never changed.',
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
  'image.enclosed': {
    title: 'Remove enclosed gaps too',
    text: 'Also removes patches of the background colour that are cut off from the edge, like the gap between an arm and a staff. Turn it off if it eats into a white shield or eyes.',
    media: beforeAfter('image-enclosed', 'the white gap between the arm and the body is removed too'),
  },
  'background.removeMethod': {
    title: 'How to remove it',
    text: 'Flat colour removes one plain colour and is instant. AI finds the character on any background, using a model that runs in your browser.',
    media: beforeAfter('background-removeMethod', 'a busy background is cut away by the AI'),
  },
  'background.aiRemove': {
    title: 'AI cut-out',
    text: 'An AI model finds your character and hides everything else. It downloads once (about 100 MB) and runs on this device, so your picture is never uploaded.',
    media: beforeAfter('background-aiRemove', 'the character is cut out from a busy background'),
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
  'background.kind': { title: 'Background', text: 'What fills the frame behind your art: nothing, a colour, a gradient or a picture.', media: beforeAfter('background-kind', 'an empty background becomes a gradient') },
  'background.color': { title: 'Background colour', text: 'One flat colour behind the art.', media: beforeAfter('background-color', 'the background changes from slate blue to red') },
  'background.gradientType': { title: 'Gradient type', text: 'Linear runs from one side to the other; radial spreads out from the middle.', media: beforeAfter('background-gradientType', 'a top-to-bottom gradient becomes one glowing from the middle') },
  'background.gradientAngle': { title: 'Angle', text: 'Which way a linear gradient runs: 0° goes left to right, 90° top to bottom.', media: beforeAfter('background-gradientAngle', 'the gradient turns to run left to right') },
  'background.gradientColors': { title: 'Gradient colours', text: 'The colours at the two ends. Advanced has every colour stop.', media: beforeAfter('background-gradientColors', 'the gradient changes to orange and purple') },
  'background.gradientStops': {
    title: 'Colour stops',
    text: 'Each stop is a colour at a point along the gradient, with its own opacity. Add stops for more colours; drag Position to move one.',
    media: beforeAfter('background-gradientStops', 'two more colours are added in the middle of the gradient'),
  },
  'background.source': {
    title: 'Picture from',
    text: "A built-in scene, a picture of your own (uploaded or from a link), or an enlarged copy of the token's own art.",
    media: beforeAfter('background-source', 'the forest is swapped for a blurred, enlarged copy of the art'),
  },
  'background.library': { title: 'Built-in pictures', text: 'Scenes drawn for Token Maker, free to use on any token.', media: beforeAfter('background-library', 'a night sky appears behind the goblin') },
  'background.upload': { title: 'Your own background', text: 'Choose a picture from your device, or paste a link below. It only changes the background, not your art.', media: beforeAfter('background-upload', 'a wooden picture is used as the background') },
  'background.blur': {
    title: 'Blur',
    text: 'Softens the background picture so your art stands out. A blurred copy of the art itself makes a neat matching background.',
    media: beforeAfter('background-blur', 'the forest behind the goblin is blurred'),
  },
  'background.zoom': { title: 'Zoom', text: 'Makes the background picture bigger or smaller, without changing the art.', media: beforeAfter('background-zoom', 'the forest is zoomed in') },
  'background.move': { title: 'Move the background', text: 'Turn this on, then drag on the canvas to slide the background picture. Reset puts it back in the middle.', media: beforeAfter('background-move', 'the forest slides to one side') },
  'background.opacity': { title: 'Opacity', text: 'How solid the background is. Below 100% the backing colour shows through.', media: beforeAfter('background-opacity', 'the forest fades so the red backing shows through') },

  // ---- Lighting (Phase 4) ----
  'lighting.presets': {
    title: 'Lighting presets',
    text: 'Ready-made lights: Torchlight from below, Moonlight from above, and more. Pick one, then change anything you like.',
    media: beforeAfter('lighting-presets', 'the Moonlight preset lights the goblin from above'),
  },
  'lighting.enabled': { title: 'Light the art', text: 'Shines a coloured light on the art from one side, darkening the far side.', media: beforeAfter('lighting-enabled', 'a soft light is switched on') },
  'lighting.direction': {
    title: 'Light direction',
    text: 'Where the light comes from: drag the dot round the dial. Shadows fall away from it, even when the light is off.',
    media: beforeAfter('lighting-direction', 'the light moves from below to above'),
  },
  'lighting.color': { title: 'Light colour', text: 'Warm orange for torches and fire, cool blue for moonlight, green for fel magic.', media: beforeAfter('lighting-color', 'orange torchlight becomes green') },
  'lighting.strength': { title: 'Strength', text: 'How bright and coloured the light is.', media: beforeAfter('lighting-strength', 'a weak light becomes a strong one') },
  'lighting.falloff': { title: 'Darkness away from the light', text: 'How much darker the side facing away from the light gets.', media: beforeAfter('lighting-falloff', 'the side away from the light gets much darker') },
  'lighting.rim': {
    title: 'Rim light',
    text: 'A thin bright edge on the side facing the light. It works best when the background has been removed.',
    media: beforeAfter('lighting-rim', 'a bright edge appears along the top of the goblin'),
  },
  'lighting.rimStrength': { title: 'Rim strength', text: 'How bright the rim is.', media: beforeAfter('lighting-rimStrength', 'the bright edge gets brighter') },
  'lighting.rimWidth': { title: 'Rim width', text: 'How thick the rim is.', media: beforeAfter('lighting-rimWidth', 'the bright edge gets thicker') },
  'lighting.rimSoftness': { title: 'Rim softness', text: 'How gently the rim fades into the art. 0% is a crisp, bright edge; higher values blend it in like a soft back light.', media: beforeAfter('lighting-rimSoftness', 'a crisp bright edge fades softly into the art') },
  'lighting.background': { title: 'Light the background too', text: 'Lights the background picture the same way, so the art and the scene match.', media: beforeAfter('lighting-background', 'the forest is lit the same way as the goblin') },

  // ---- Shadows (Phase 5) ----
  'shadows.outer': {
    title: 'Drop shadow',
    text: "The shadow the whole token casts on the map, pop-out parts included. It falls away from the light unless you unlink it.",
    media: beforeAfter('shadows-outer', 'a drop shadow appears under the token'),
  },
  'shadows.popOut': {
    title: 'Pop-out shadow',
    text: 'The shadow pop-out parts (like horns) cast onto the frame, so they look raised above it.',
    media: beforeAfter('shadows-popOut', 'the popped-out ears cast a shadow onto the frame'),
  },
  'shadows.follow': {
    title: 'Follow the light',
    text: 'On: the shadow falls away from the light. Turn it off to set the direction, distance, blur, colour and opacity yourself.',
    media: beforeAfter('shadows-follow', 'the shadow stops following the light and falls to the left'),
  },
  'shadows.angle': { title: 'Shadow direction', text: 'Which way the shadow falls: drag the dot round the dial.', media: beforeAfter('shadows-angle', 'the shadow turns to fall the other way') },
  'shadows.distance': {
    title: 'Shadow distance',
    text: 'How far the shadow falls from what casts it, as a share of one grid square, so it looks the same on the map at every size.',
    media: beforeAfter('shadows-distance', 'the shadow moves further from the token'),
  },
  'shadows.blur': { title: 'Shadow blur', text: 'How soft the shadow is, as a share of one grid square.', media: beforeAfter('shadows-blur', 'a sharp shadow becomes soft') },
  'shadows.color': { title: 'Shadow colour', text: 'Black for a plain shadow, or a dark colour to match the scene.', media: beforeAfter('shadows-color', 'a black shadow turns purple') },
  'shadows.opacity': { title: 'Shadow opacity', text: 'How dark the shadow is.', media: beforeAfter('shadows-opacity', 'a faint shadow becomes dark') },
  'shadows.inner': { title: 'Inner shadow', text: 'The shadow the frame casts onto the art, which makes the art look set into the token.', media: beforeAfter('shadows-inner', 'the frame casts a shadow onto the art') },
  'shadows.innerStrength': { title: 'Inner shadow strength', text: 'How dark the shadow inside the frame is.', media: beforeAfter('shadows-innerStrength', 'the shadow inside the frame gets darker') },
  'shadows.innerSoftness': { title: 'Inner shadow softness', text: 'How far the shadow inside the frame spreads, as a share of one grid square.', media: beforeAfter('shadows-innerSoftness', 'the shadow inside the frame spreads further') },

  // ---- Pop-out (Phase 5) ----
  'popout.brush': {
    title: 'Pop-out brush',
    text: 'Paint over the parts of the art that should be drawn on top of the frame, like horns, a head or a sword. They stay on the art when you move, zoom, turn or flip it.',
    media: beforeAfter('popout-brush', 'the goblin\'s ears are painted to break over the frame'),
  },
  'popout.mode': { title: 'Add or erase', text: 'Add paints more of the art over the frame; Erase takes it back behind the frame.', media: beforeAfter('popout-mode', 'part of one ear is erased back behind the frame') },
  'popout.size': { title: 'Brush size', text: 'How big the pop-out brush is on screen. Zoom the view in for fine edges.', media: beforeAfter('popout-size', 'a thin brush line becomes a wide one') },
  'popout.show': { title: 'Show the pop-out mask', text: 'Tints the painted parts teal while you paint, so you can see exactly what pops out. It never shows in the export.', media: beforeAfter('popout-show', 'the painted parts are tinted teal') },
  'popout.enabled': { title: 'Pop-out on', text: 'Turn off to put everything back inside the frame without losing what you painted.', media: beforeAfter('popout-enabled', 'the painted ears go back over the frame') },
  'popout.advanced': { title: 'More brush settings', text: 'Softness and pen pressure for the pop-out brush (shared with the erase/restore brush).', media: beforeAfter('popout-advanced', 'the pop-out\'s edge gets softer') },
  'popout.softness': { title: 'Softness', text: 'How gently the edge of the pop-out fades into the frame.', media: beforeAfter('popout-softness', 'the pop-out\'s edge gets softer') },

  // ---- Effects (Phase 6) ----
  'effects.add': {
    title: 'Add an effect',
    text: 'Pick an effect to add it to the stack. Hover a name (or press and hold it) to see what it does.',
    media: beforeAfter('effects-add', 'a frost border, mist over the art and a bloodied look'),
  },
  'effects.placement': {
    title: 'Placement',
    text: 'Behind art shows through where the background was removed, Over art sits on top of the picture, and On border is drawn on the frame. Effects with the same placement are drawn in list order.',
    media: beforeAfter('effects-placement', 'an outer glow on the border, then behind a cut-out creature'),
  },
  'effects.intensity': {
    title: 'Intensity',
    text: 'How strong the effect is.',
    media: beforeAfter('effects-intensity', 'fire at low and full intensity'),
  },
  'effects.advanced': { title: 'More effect settings', text: 'Size, spread, softness, blend mode and Shuffle for this effect.', media: beforeAfter('effects-advanced', 'orange fire turns into bigger blue flames all round') },
  'effects.color': {
    title: 'Colour',
    text: 'The colour of the effect, like arcane blue or radiant gold.',
    media: beforeAfter('effects-color', 'a fire turned from orange to blue'),
  },
  'effects.size': {
    title: 'Size',
    text: 'How far it reaches, like the height of the flames or the width of a glow, as a share of one grid square so it looks the same on the map at every creature size.',
    media: beforeAfter('effects-size', 'small and large frost'),
  },
  'effects.spread': {
    title: 'Spread',
    text: 'How much of the token it covers: flames and mist creep further round from the bottom, and glows stay solid for longer before they fade.',
    media: beforeAfter('effects-spread', 'fire only at the bottom, then all the way round'),
  },
  'effects.blur': { title: 'Blur', text: 'Softens the whole effect, as a share of one grid square, so sharp flames or sparks become a soft haze.', media: beforeAfter('effects-blur', 'sharp lightning becomes a soft blur') },
  'effects.blend': {
    title: 'Blend mode',
    text: 'How the effect mixes with what is under it: Normal keeps its own look, Multiply darkens, Screen lightens, Overlay and Soft light add contrast and colour.',
    media: beforeAfter('effects-blend', 'a gradient that hides the goblin is blended in so the goblin shows through'),
  },
  'effects.angle': { title: 'Side', text: 'Which side or corner of the token the overlay sits on.', media: beforeAfter('effects-angle', 'foliage moves from the bottom to the top-left corner') },
  'effects.softness': { title: 'Softness', text: 'How gently the overlay fades out.', media: beforeAfter('effects-softness', 'a hard-edged shadow becomes a soft fade') },
  'effects.layout': { title: 'Layout', text: 'Scatter sprinkles copies of the picture round the token; Fill stretches one copy over the whole area, like a texture.', media: beforeAfter('effects-layout', 'scattered smoke puffs become one picture filling the token') },
  'effects.tint': { title: 'Colour it in', text: "Colours the picture with the effect's colour. Turn it off to keep a picture's own colours.", media: beforeAfter('effects-tint', 'white twinkles turn gold') },
  'effects.upload': {
    title: 'Use your own picture',
    text: 'Add any picture, like a texture or a transparent PNG, as an effect. It is kept in this browser for next time.',
    media: beforeAfter('effects-upload', 'a picture of your own is added over the token'),
  },
  'effects.shuffle': {
    title: 'Shuffle',
    text: 'Rearranges the flames, sparks, drops or bolts at random. Each layout is kept, so the token always looks the same.',
    media: beforeAfter('effects-shuffle', 'two layouts of lightning'),
  },
  'effect.outerGlow': { title: 'Outer glow', text: 'A glow around the token, or around a cut-out creature when placed behind the art.', media: beforeAfter('effect-outerGlow', 'an outer glow') },
  'effect.innerGlow': { title: 'Inner glow', text: 'Light shining in from the edge of the frame.', media: beforeAfter('effect-innerGlow', 'an inner glow') },
  'effect.fire': { title: 'Fire', text: 'Flames licking up from the edge.', media: beforeAfter('effect-fire', 'fire') },
  'effect.frost': { title: 'Frost', text: 'Ice shards and a cold glow around the edge.', media: beforeAfter('effect-frost', 'frost') },
  'effect.poison': { title: 'Poison', text: 'Dripping green ooze and bubbles.', media: beforeAfter('effect-poison', 'poison') },
  'effect.lightning': { title: 'Lightning', text: 'Crackling bolts arcing around the edge.', media: beforeAfter('effect-lightning', 'lightning') },
  'effect.necrotic': { title: 'Necrotic', text: 'Dark, withering tendrils creeping in from the edge.', media: beforeAfter('effect-necrotic', 'necrotic energy') },
  'effect.radiant': { title: 'Radiant', text: 'Holy light: a bright glow, rays and glints.', media: beforeAfter('effect-radiant', 'radiant light') },
  'effect.bloodied': { title: 'Bloodied', text: 'Blood splatters, for a creature at half its hit points or less.', media: beforeAfter('effect-bloodied', 'the bloodied look') },
  'effect.petrified': { title: 'Petrified', text: 'Turns everything under it to cracked grey stone.', media: beforeAfter('effect-petrified', 'the petrified look') },
  'effect.ethereal': {
    title: 'Ethereal',
    text: 'Makes the token see-through and ghostly, for ethereal or invisible creatures.',
    media: beforeAfter('effect-ethereal', 'the ethereal look'),
  },
  'effect.frightened': { title: 'Frightened', text: 'A cold, dark wash with shiver marks.', media: beforeAfter('effect-frightened', 'the frightened look') },
  'effect.poisoned': { title: 'Poisoned', text: 'A sickly green tint with bubbles.', media: beforeAfter('effect-poisoned', 'the poisoned look') },
  'effect.charmed': { title: 'Charmed', text: 'A pink glow with floating hearts.', media: beforeAfter('effect-charmed', 'the charmed look') },
  'effect.unconscious': { title: 'Unconscious', text: 'Greyed out and dimmed, with a "Zzz".', media: beforeAfter('effect-unconscious', 'the unconscious look') },
  'effect.mist': { title: 'Mist', text: 'Low mist rising from the bottom.', media: beforeAfter('effect-mist', 'mist') },
  'effect.embers': { title: 'Embers', text: 'Glowing sparks drifting upwards.', media: beforeAfter('effect-embers', 'embers') },
  'effect.sparkles': { title: 'Sparkles', text: 'Twinkling glints of light.', media: beforeAfter('effect-sparkles', 'sparkles') },
  'effect.smoke': { title: 'Smoke', text: 'Billowing smoke rising from the bottom.', media: beforeAfter('effect-smoke', 'smoke') },
  'effect.vignette': { title: 'Vignette', text: 'Darkens the edge of the art so the eye goes to the middle.', media: beforeAfter('effect-vignette', 'a vignette') },
  'effect.gradient': { title: 'Gradient', text: 'A wash of colour across the art, blended in so the art shows through.', media: beforeAfter('effect-gradient', 'a warm gradient wash') },
  'effect.edgeShadow': { title: 'Edge shadow', text: 'A shadow creeping in from one side of the art.', media: beforeAfter('effect-edgeShadow', 'an edge shadow from the bottom') },
  'effect.foliage': { title: 'Foliage', text: 'Leafy stems growing in from one side.', media: beforeAfter('effect-foliage', 'foliage') },
  'effect.cobwebs': { title: 'Cobwebs', text: 'A web spun in one corner.', media: beforeAfter('effect-cobwebs', 'cobwebs') },
  'effect.picture': { title: 'Picture effects', text: 'Free sprites (smoke, flames, sparks, claw marks and more) scattered round the token in any colour.', media: beforeAfter('effect-picture', 'smoke puffs and twinkles') },

  // ---- Frame & shape ----
  // ---- Decorations (DESIGN.md §6.9) ----
  'decorations.add': {
    title: 'Add a decoration',
    text: 'Pick a gem, horn, wing or other decoration. It snaps onto the frame; drag it on the canvas to move it, and use its handles to resize and turn it.',
    media: beforeAfter('decorations-add', 'a gem is added to the top of the frame'),
  },
  'decorations.picture': {
    title: 'Pictures',
    text: 'Flat icons, like a heart or a potion, in any colour, or a picture of your own (kept in this browser for next time).',
    media: beforeAfter('decorations-picture', 'a red heart icon is added to the frame'),
  },
  'decorations.tint': { title: 'Colour it in', text: "Colours the picture with the decoration's colour. Turn it off to keep a picture's own colours.", media: beforeAfter('decorations-tint', 'a white icon turns gold') },
  'decorations.place': {
    title: 'Position',
    text: 'Snap it to the top, bottom, sides or corners of the frame, where it turns to face outwards, or choose Free to put it anywhere.',
    media: beforeAfter('decorations-place', 'the gem moves from the top to the bottom-right'),
  },
  'decorations.mirror': { title: 'Mirror on the other side', text: 'Adds a matching copy on the opposite side, like a pair of horns or wings.', media: beforeAfter('decorations-mirror', 'one horn gets a matching pair') },
  'decorations.size': { title: 'Size', text: 'How tall it is, as a share of one grid square, so it looks the same size on the map whatever the creature.', media: beforeAfter('decorations-size', 'a small gem gets bigger') },
  'decorations.rotation': { title: 'Rotation', text: 'Turns it. Snapped decorations turn from the way they face; you can also drag the round handle on the canvas.', media: beforeAfter('decorations-rotation', 'the sword turns') },
  'decorations.color': { title: 'Tint', text: 'The main colour of the decoration.', media: beforeAfter('decorations-color', 'a red gem turns green') },
  'decorations.opacity': { title: 'Opacity', text: 'Lower it to let the token show through.', media: beforeAfter('decorations-opacity', 'the crown fades') },
  'decorations.flip': { title: 'Flip', text: 'Flips it left to right.', media: beforeAfter('decorations-flip', 'the sword flips left to right') },

  // ---- Label (DESIGN.md §6.10) ----
  'label.add': { title: 'Label', text: "Adds the token's name on a banner, which you can change to a plaque, pill, box, plain text or text curved round the ring. Switch it off to remove the label.", media: beforeAfter('label-add', 'a banner with the token\'s name is added') },
  'label.shape': {
    title: 'Shape',
    text: 'A banner, plaque, pill or box behind the text, Plain text with no shape, or Ring text, which curves the words round the frame.',
    media: beforeAfter('label-shape', 'a banner becomes a plaque'),
  },
  'label.text': { title: 'Text', text: "The words on the label. Leave it empty to show the token's name, which then follows any change to the name.", media: beforeAfter('label-text', 'the label\'s words change to Grik') },
  'label.font': {
    title: 'Font',
    text: 'Fantasy fonts that come with the site, so the download always uses the font you see. Each name is shown in its own font.',
    media: beforeAfter('label-font', 'the name changes to a pirate-style font'),
  },
  'label.uploadFont': {
    title: 'Upload a font',
    text: 'Use your own .ttf, .otf, .woff or .woff2 font. It is kept in this browser, and goes with any preset you share that uses it.',
    media: beforeAfter('label-uploadFont', 'the name changes to another font'),
  },
  'label.size': { title: 'Text size', text: 'How big the letters are, as a share of one grid square, so the label looks the same size on the map whatever the creature.', media: beforeAfter('label-size', 'small letters become big letters') },
  'label.color': { title: 'Text colour', text: 'The colour of the letters.', media: beforeAfter('label-color', 'dark brown letters turn red') },
  'label.style': { title: 'Style', text: 'Bold and italic. Fonts without their own bold or italic are thickened or slanted by the browser.', media: beforeAfter('label-style', 'plain letters become bold and italic') },
  'label.align': { title: 'Alignment', text: 'Where the words sit on the shape: left, centre or right. On the ring they start, centre or end at the label’s position.', media: beforeAfter('label-align', 'centred words move to the left') },
  'label.place': {
    title: 'Position',
    text: 'Snap the label to the top or bottom of the frame, or choose Free to put it anywhere. You can also drag it on the canvas.',
    media: beforeAfter('label-place', 'the banner moves from the bottom to the top'),
  },
  'label.angle': { title: 'Round the ring', text: 'Where the middle of the ring text sits: 90° is the bottom, 270° the top.', media: beforeAfter('label-angle', 'ring text moves from the bottom to the top of the ring') },
  'label.x': { title: 'Sideways', text: "Moves the label left or right, as a share of the token's half-width.", media: beforeAfter('label-x', 'the label moves to the right') },
  'label.y': { title: 'Up or down', text: "Moves the label up or down, as a share of the token's half-height.", media: beforeAfter('label-y', 'the label moves up') },
  'label.anchor': { title: 'Anchor point', text: 'Which point of the label sits at its position: a corner, an edge or the middle. The label turns round this point.', media: beforeAfter('label-anchor', 'the label is pinned by its left end') },
  'label.rotation': { title: 'Rotation', text: 'Turns a free label round its anchor point.', media: beforeAfter('label-rotation', 'the label is turned at an angle') },
  'label.arc': { title: 'Most of the ring it covers', text: 'How far round the ring the words may reach. Longer names shrink to fit inside it when Shrink long names is on.', media: beforeAfter('label-arc', 'a long name squeezed into a short arc spreads round the ring') },
  'label.width': { title: 'Width', text: 'How wide the shape is, as a share of one grid square.', media: beforeAfter('label-width', 'a narrow banner becomes wide') },
  'label.curve': { title: 'Bend', text: 'Bends the banner so it hugs the ring. Positive bends the ends up (for the bottom), negative bends them down (for the top).', media: beforeAfter('label-curve', 'a straight banner bends') },
  'label.corners': { title: 'Corners', text: 'Rounded or sharp corners on the box.', media: beforeAfter('label-corners', 'rounded corners become sharp') },
  'label.fill': { title: 'Shape colour', text: 'The colour of the banner, plaque, pill or box. It is shaded lighter at the top, like the frames.', media: beforeAfter('label-fill', 'a parchment banner turns red') },
  'label.opacity': { title: 'Shape opacity', text: 'Lower it to let the token show through the shape. The text stays solid.', media: beforeAfter('label-opacity', 'the banner fades so the token shows through') },
  'label.outline': { title: 'Shape outline', text: 'A line round the shape, as a share of one grid square. Set it to 0 for none.', media: beforeAfter('label-outline', 'a thick line is drawn round the banner') },
  'label.outlineColor': { title: 'Outline colour', text: 'The colour of the line round the shape.', media: beforeAfter('label-outlineColor', 'the line round the banner turns gold') },
  'label.shrink': {
    title: 'Shrink long names to fit',
    text: 'Long names get smaller so they never spill off the shape or past the ring. Switch it off to make the shape grow to fit the words instead.',
    media: beforeAfter('label-shrink', 'a long name that spilled off the banner shrinks to fit'),
  },
  'label.advanced': { title: 'Advanced', text: 'Letter spacing, an outline round the letters and a text shadow.', media: beforeAfter('label-advanced', 'the letters get spacing, an outline and a shadow') },
  'label.spacing': { title: 'Letter spacing', text: 'Extra room between letters, as a share of the text size. Below 0 pulls them closer.', media: beforeAfter('label-spacing', 'the letters spread apart') },
  'label.textOutline': { title: 'Text outline', text: 'A line round every letter, which helps the words stand out on a busy token. Set it to 0 for none.', media: beforeAfter('label-textOutline', 'ring text over a busy forest gets a dark outline') },
  'label.textOutlineColor': { title: 'Text outline colour', text: 'The colour of the line round the letters.', media: beforeAfter('label-textOutlineColor', 'the outline round the letters turns red') },
  'label.shadow': { title: 'Text shadow', text: 'A soft shadow under the letters that falls away from the light, like the token’s own shadow.', media: beforeAfter('label-shadow', 'a shadow appears under the ring text') },
  'label.shadowColor': { title: 'Shadow colour', text: 'The colour of the text shadow.', media: beforeAfter('label-shadowColor', 'the text shadow turns orange') },
  'label.shadowOpacity': { title: 'Shadow opacity', text: 'How dark the text shadow is.', media: beforeAfter('label-shadowOpacity', 'a faint text shadow becomes dark') },
  'label.shadowBlur': { title: 'Shadow blur', text: 'How soft the text shadow is, as a share of one grid square.', media: beforeAfter('label-shadowBlur', 'a sharp text shadow becomes soft') },

  // ---- Presets (DESIGN.md §6.9) ----
  'presets.builtIn': {
    title: 'Built-in presets',
    text: 'One tap styles the frame, lighting, effects and decorations together. Your art, name and size stay, and everything stays editable.',
    media: beforeAfter('presets-builtIn', 'one tap gives the token the Undead look'),
  },
  'presets.save': { title: 'Save this look', text: 'Keeps the current look (everything except your art) as a preset in this browser, to use on other tokens.', media: beforeAfter('presets-save', 'a saved look is used on another goblin') },
  'presets.yours': {
    title: 'Your presets',
    text: 'Tap a name to use it. The copy button gives a text code you can paste anywhere to share it, and the download button saves a .tokenpreset.json file.',
    media: beforeAfter('presets-yours', 'one of your presets is used on another goblin'),
  },
  'presets.import': {
    title: 'Add a shared preset',
    text: 'Paste a preset code or open a .tokenpreset.json file someone shared. It is added to your presets and used straight away.',
    media: beforeAfter('presets-import', 'a shared preset is used on another goblin'),
  },

  'frame.shape': { title: 'Shape', text: 'The outline of the token. Hexagons suit hex-grid maps.', media: beforeAfter('frame-shape', 'a round token becomes a hexagon') },
  'frame.kind': {
    title: 'Frame type',
    text: 'Drawn frames are made by the site in any colour and thickness, and Frame Studio frames are designs you made in Frame Studio. Picture frames use a PNG with a see-through middle, built in or your own.',
    media: beforeAfter('frame-kind', 'a drawn frame becomes a gold laurel picture frame'),
  },
  'frame.picture': {
    title: 'Picture frame',
    text: 'Pick a frame picture. Unlike drawn frames, picture frames grow with the token, so on a Large token the border is twice as thick on the map.',
    media: beforeAfter('frame-picture', 'a rope frame becomes a dragon-scale frame'),
  },
  'frame.upload': {
    title: 'Upload a frame',
    text: 'Use your own PNG ring with a see-through middle: the site finds the hole and shows the art through it. Your frames are kept in this browser.',
    media: beforeAfter('frame-upload', 'a purple ring picture becomes the frame'),
  },
  'frame.design': {
    title: 'Frame Studio design',
    text: 'Pick a design you opened from Frame Studio. It follows the token shape, thickness and spacing, like a drawn frame.',
    media: beforeAfter('frame-design', 'a drawn frame becomes a Frame Studio design'),
  },
  'frame.designOpen': {
    title: 'Open a Frame Studio design',
    text: 'Open a .framestudio.json file saved in Frame Studio to use it as the frame. Your designs are kept in this browser.',
    media: beforeAfter('frame-designOpen', 'a design file is opened and becomes the frame'),
  },
  'frame.holeSize': { title: 'Hole size', text: "Make the art's opening bigger or smaller if the hole found in the picture doesn't quite fit.", media: beforeAfter('frame-holeSize', 'a too-small hole is made to fit the frame') },
  'frame.holeX': { title: 'Move hole sideways', text: "Nudge the art's opening left or right to line it up with the frame picture.", media: beforeAfter('frame-holeX', 'a hole that sat off to one side is lined up') },
  'frame.holeY': { title: 'Move hole up or down', text: "Nudge the art's opening up or down to line it up with the frame picture.", media: beforeAfter('frame-holeY', 'a hole that sat too low is lined up') },
  'frame.holeReset': { title: 'Reset the hole', text: 'Go back to the hole the site found in the picture.', media: beforeAfter('frame-holeReset', 'a nudged hole goes back to the one that was found') },
  'frame.style': {
    title: 'Frame',
    text: 'The border drawn around the art. Every frame takes any colour, thickness and spacing.',
    media: beforeAfter('frame-style', 'the frame changes to the Druid vines'),
  },
  'frame.color': {
    title: 'Frame colour',
    text: "The frame's main colour. Lighting, texture and ornaments are recoloured to match.",
    media: beforeAfter('frame-color', 'an orange frame turns blue'),
  },
  'frame.thickness': {
    title: 'Thickness',
    text: 'How wide the border is, as a share of one grid square, so it looks the same on the map at every creature size.',
    media: beforeAfter('frame-thickness', 'a thin frame gets thick'),
  },
  'frame.highlight': {
    title: 'Frame highlights colour',
    text: 'Some frames have details in a colour of their own, like the jade beads on Monk or the eyes on Warlock. Change those here.',
    media: beforeAfter('frame-highlight', 'Monk\'s green beads turn red'),
  },
  'frame.outerSpacing': {
    title: 'Outer spacing',
    text: 'Empty space between the edge of the image and the frame, which leaves room for the drop shadow.',
    media: beforeAfter('frame-outerSpacing', 'space is added round the outside of the frame'),
  },
  'frame.innerSpacing': {
    title: 'Inner spacing',
    text: 'A gap between the frame and the art, filled with the backing colour.',
    media: beforeAfter('frame-innerSpacing', 'a gold gap appears between the frame and the art'),
  },
  'frame.backingColor': {
    title: 'Backing colour',
    text: 'The colour behind the art. It shows through the inner spacing and any transparent parts of the picture.',
    media: beforeAfter('frame-backingColor', 'the dark backing behind the cut-out goblin turns red'),
  },
  'frame.backingOpacity': { title: 'Backing opacity', text: 'Set to 0% for no backing, so transparent parts of the art stay see-through.', media: beforeAfter('frame-backingOpacity', 'the backing goes, so the token is see-through behind the goblin') },

  // ---- Size ----
  'size.preset': {
    title: 'Creature size',
    text: 'How many grid squares the creature covers: Tiny is half a square, Large is 2 × 2, Huge 3 × 3 and Gargantuan 4 × 4.',
    media: beforeAfter('size-preset', 'a Medium token becomes a Huge one covering 3 × 3 squares'),
  },
  'size.custom': { title: 'Squares', text: 'Any number of squares across, in half-square steps.', media: beforeAfter('size-custom', 'a 2-square token becomes 2½ squares') },

  // ---- Export ----
  'export.format': {
    title: 'Format',
    text: 'PNG is lossless and works in every VTT. WebP is see-through too, and a much smaller file.',
    media: beforeAfter('export-format', 'a large PNG file becomes a much smaller WebP that looks the same'),
  },
  'export.resolution': {
    title: 'Pixels per square',
    text: 'How many pixels each grid square gets, so a Large token at 256 is 512 × 512 px. 256 suits most VTTs; the longest side is capped at 4096 px.',
    media: beforeAfter('export-resolution', 'a blocky small file becomes a sharp large one'),
  },
  'export.customPx': { title: 'Custom pixels per square', text: 'Any size from 32 to 4096 pixels per square. The final picture is never more than 4096 px across.', media: beforeAfter('export-customPx', 'a blocky small file becomes a sharp large one') },
  'export.fileName': {
    title: 'File name',
    text: "Starts as the token's name and only keeps letters, numbers, spaces, dashes and underscores, so it works on every computer. Batch tokens each use their own name.",
    media: beforeAfter('export-fileName', 'a name with question marks becomes a safe file name'),
  },
  'export.copy': {
    title: 'Copy to clipboard',
    text: 'Copies the token as a PNG so you can paste it straight into a VTT, chat or document. Some browsers can only download pictures, not copy them.',
    media: beforeAfter('export-copy', 'the token is pasted onto a map'),
  },
  'export.all': {
    title: 'Export all as ZIP',
    text: 'Makes every token in the batch with the shared style and saves them in one ZIP file, each named after its token.',
    media: beforeAfter('export-all', 'one token becomes four, each with its own name'),
  },
  'export.advanced': { title: 'Advanced', text: 'Fine-tune the file size of WebP files.', media: beforeAfter('export-advanced', 'lower quality makes a smaller, blotchier picture') },
  'export.quality': {
    title: 'Quality',
    text: 'Lower makes a smaller file with a slightly blurrier, blockier picture. 92% is hard to tell apart from the original.',
    media: beforeAfter('export-quality', 'lower quality makes a smaller, blotchier picture'),
  },

  // ---- Batch mode ----
  'batch.strip': {
    title: 'Tokens in the batch',
    text: 'Every picture in the batch, drawn with the shared style; tap one to move, crop, brush or rename just that token. Changes to the style apply to all of them.',
    media: beforeAfter('batch-strip', 'one token becomes four that share one style'),
  },

  // ---- Canvas ----
  'canvas.stage': {
    title: 'Editing the art',
    text: 'Drag to move the art, use the corner handles to resize it and the round handle to rotate it (or pinch and twist with two fingers). Scroll over the token to zoom the view in for a closer look, and hold Space or the middle mouse button and drag to look around.',
    media: beforeAfter('canvas-stage', 'the art is moved, resized and turned'),
  },

  // ---- Top bar ----
  'topbar.batch': {
    title: 'Batch mode',
    text: 'Make several tokens at once with one shared style: upload, drop or link several pictures, and each keeps its own position, brush work and name. Export them all as a ZIP.',
    media: beforeAfter('topbar-batch', 'one token becomes four that share one style'),
  },
  'panel.menuStyle': {
    title: 'Menu style',
    text: 'Simple hides the extra settings, Advanced keeps them in closed Advanced drop-downs, and Expert shows them all the time.',
    media: beforeAfter('panel-menuStyle', 'the Advanced drop-downs open up'),
  },
  'topbar.theme': {
    title: 'Theme',
    text: 'Switch between the dark look (the default) and the light look.',
    media: beforeAfter('topbar-theme', 'the dark look becomes the light look'),
  },

  // ---- Floating canvas toolbar ----
  'toolbar.zoom': {
    title: 'Zoom',
    text: 'Make the art bigger or smaller inside the frame. You can also drag the corner handles or pinch with two fingers.',
    media: beforeAfter('toolbar-zoom', 'the art gets bigger inside the frame'),
  },
  'toolbar.rotate': { title: 'Rotate', text: 'Turn the art a quarter turn clockwise. Use the round handle on the canvas, or two fingers, for any angle.', media: beforeAfter('toolbar-rotate', 'the art turns a quarter turn') },
  'toolbar.flip': { title: 'Flip sideways', text: 'Mirror the art left to right, so the creature faces the other way.', media: beforeAfter('toolbar-flip', 'the art is mirrored left to right') },
  'toolbar.flipV': { title: 'Flip upside down', text: 'Mirror the art top to bottom.', media: beforeAfter('toolbar-flipV', 'the art is turned upside down') },
  'toolbar.reset': { title: 'Reset', text: 'Put the art back to how it was first placed: centred, unrotated and filling the frame.', media: beforeAfter('toolbar-reset', 'moved and turned art goes back to its first place') },
  'toolbar.fit': { title: 'Fit', text: 'Shrink the art so all of it is visible inside the frame.', media: beforeAfter('toolbar-fit', 'the art shrinks so all of it shows') },
  'toolbar.fill': { title: 'Fill', text: 'Enlarge the art so it covers the whole inside of the frame with no gaps.', media: beforeAfter('toolbar-fill', 'the art grows to cover the whole frame') },

  // ---- Shared component examples (UI kit page) ----
  'kit.slider': {
    title: 'Slider',
    text: 'Drag the handle, use the arrow keys, or type an exact number in the box. A whole drag is one undo step.',
    media: beforeAfter('kit-slider', 'the goblin gets brighter'),
  },
  'kit.advanced': {
    title: 'Advanced',
    text: 'Extra fine-tuning controls. You never need these for a good-looking token.',
    media: beforeAfter('kit-advanced', 'the goblin gets warmer and older-looking'),
  },
  'kit.swatches': {
    title: 'Colour',
    text: 'Pick a ready-made colour or choose any colour with the picker. You can also type a hex code like #d6a24e.',
    media: beforeAfter('kit-swatches', 'an orange frame turns blue'),
  },
  'kit.segmented': { title: 'Shape', text: 'Choose one option. Use the arrow keys to move between them.', media: beforeAfter('kit-segmented', 'a round token becomes a hexagon') },
  'kit.tiles': { title: 'Frame style', text: 'Pick a tile. Every frame takes any colour, thickness and spacing.', media: beforeAfter('kit-tiles', 'the frame changes to Arcane') },
  'kit.strip': { title: 'Images on the page', text: 'Pick the image you want to use. Tiny icons are hidden.', media: beforeAfter('kit-strip', 'picking a picture makes the token') },
  'kit.toggle': { title: 'Toggle', text: 'Turns a setting on or off.', media: beforeAfter('kit-toggle', 'switching the drop shadow on') },
} satisfies Record<string, HelpEntry>;

export type HelpId = keyof typeof helpContent;

export function getHelp(id: HelpId): HelpEntry {
  return helpContent[id];
}
