# Token Maker — Design Document

> **Working title:** Token Maker (final name and logo to be decided).
> **Purpose of this file:** the single source of truth for the project. Any AI or person building the site should read this whole file before writing code, follow it, and update it when a decision changes. Put it in the repository at `docs/DESIGN.md`.

---

## 1. What we are building

A free website where anyone can quickly make a great-looking token for D&D and other tabletop RPGs (TTRPGs): import a picture, frame it, style it, and download it ready for a virtual tabletop (VTT) such as Owlbear Rodeo, Foundry VTT or Roll20.

**Goals**

- **Fast for beginners:** a good-looking token in under a minute with defaults and presets.
- **Deep for enthusiasts:** every look can be fine-tuned. Advanced controls live in collapsible "Advanced" sections so the simple view stays simple.
- **Desktop and phone equally:** every feature must work with mouse, touch and pen. Not desktop-first.
- **Runs in the browser:** images are processed on the visitor's device. The only server code is a small, safe image-fetching proxy. No accounts, no database (for now).
- **Free to host:** Cloudflare Pages + Pages Functions (free tier).

**Non-goals for version 1** (see §15 Future features): AI features, animation, accounts, adverts switched on, Pinterest board browsing, direct sending to VTTs.

---

## 2. Starting point: the existing extension

The owner built an Owlbear Rodeo extension with a token editor:
<https://github.com/GroudonMcL/LK-to-Owlbear-Combined>

Reuse its proven parts, but **do not** copy anything about LegendKeeper, Owlbear, the Worker's API keys or access passwords — this site is standalone.

**Worth reusing (read the code in `extension/` before building the renderer):**

- The canvas token renderer: 5 shapes (Circle, Rounded, Square, Hexagon, Flat hex) and 27 code-drawn frames in three groups — **Classic** (Stamped, Gilded, Engraved, Arcane, Infernal, Double line, Polished, No frame), **Textures** (Oak, Cobblestone, Magma, Harlequin, Knotwork, Starfield) and **Classes** (one per D&D class plus Artificer). All are built like Stamped: a band lit from the top left, a pressed-in inner step, a drop shadow and a shadow cast onto the art. Every frame takes any colour, thickness, spacing and backing.
- "The export comes from the same renderer as the preview" — keep this rule.
- Crop geometry (drag, pinch zoom, rotate, flip, fit/fill/reset, dimmed art outside the frame).
- Brightness/contrast/saturation and flat-background removal.
- Creature sizes: Tiny ½, Small 1, Medium 1, Large 2, Huge 3, Gargantuan 4 grid squares.
- The SSRF-safe image fetching rules from `server/` (https only, refuse private IPs and local names, size caps, content sniffing).
- `extension/scripts/frame-sheet.ts` (renders every frame on one sheet) — keep an equivalent for visual checks.
- Testing habits: Vitest unit tests and pixel-level renderer checks.

---

## 3. Tech stack

| Area | Choice | Why |
|---|---|---|
| Language | TypeScript | Same as the extension; catches mistakes early. |
| UI | React + Vite | Same as the extension. |
| Rendering | HTML Canvas 2D (OffscreenCanvas + Web Worker where helpful) | One renderer for preview and export; reuses the extension. |
| State | A single versioned `TokenDocument` (JSON) + a small store (e.g. Zustand) | Makes undo/redo, presets, autosave and batch mode simple. |
| Storage | IndexedDB (via `idb-keyval` or similar) for presets, uploaded fonts/frames, autosave; `localStorage` only for small UI preferences | No accounts yet. |
| ZIP | fflate (in a Web Worker) | Batch export. |
| Server | Cloudflare Pages Functions (`/functions/api/...`) | Image proxy for web addresses and Pinterest links only. |
| Hosting | Cloudflare Pages, deployed from GitHub | Free; owner already uses Cloudflare. |
| Tests | Vitest (unit + renderer pixel checks), Playwright (end-to-end, desktop and phone viewports) | |

The owner is **new to coding and uses Windows.** Every build step should come with plain-English instructions and Windows-friendly commands (PowerShell), and `README.md` must explain how to run, test and deploy.

---

## 4. Core concepts

### 4.1 The TokenDocument

Everything about a token is stored in one plain JSON object. The renderer is a pure function: `render(doc, assets, outputSize) → canvas`. Nothing about the look lives anywhere else.

```ts
interface TokenDocument {
  schemaVersion: number;            // bump + write a migration whenever the shape changes (9 since Frame Studio designs, §6.12)
  name: string;                     // file name / label default
  size: { preset: 'tiny'|'small'|'medium'|'large'|'huge'|'gargantuan'|'custom'; squares: number };
  shape: 'circle'|'rounded'|'square'|'hexagon'|'flatHex';
  art: ArtLayer;                    // the main imported image + its edits
  background: BackgroundLayer;
  foreground: OverlayLayer[];       // gradient, vignette, foliage, mist, lighting overlays
  lighting: LightingSettings;
  effects: EffectLayer[];           // stackable, ordered
  frame: FrameSettings;             // code-drawn or image (PNG) frame
  decorations: Decoration[];
  shadows: ShadowSettings;          // outer drop shadow, pop-out shadow, inner shadow
  label: LabelSettings | null;
}
```

*(Phase 1: the real type is in `src/document/types.ts`, defaults in `src/document/defaults.ts`. Later-phase layers have placeholder types. `art` holds the asset id plus its transform (zoom, offset, rotation, flipX, flipY, lockFill); `frame` holds the selected preset id, style, colour, highlights colour (`highlightColor`, null = the frame's own default), thickness, outer/inner spacing, backing colour and backing opacity (there is no frame opacity: frames are always solid); `shadows` holds outer, inner and pop-out settings. Saved documents go through `migrateDocument()` in `src/document/migrate.ts`, which runs version-by-version migrations and then checks every field, falling back to defaults. Phase 3 (schema version 2) added `art.adjust`, `art.removal` and `art.strokes`. Phase 5 (schema version 4) added `art.popOut` (`enabled` and its own `strokes`, which add or erase). Phase 6 (schema version 5) filled in `effects` (§6.8). Phase 7 (schema version 6) added `frame.kind` ('code' or 'image') with `frame.image` (a picture frame), filled in `decorations`, and added `lighting.rim.softness` (old documents get 0, the crisp rim they had). Phase 8 (schema version 7) filled in `label` (§6.10); old placeholder labels are dropped.)*

Images themselves are **not** stored inside the document — the document holds asset ids (e.g. `asset:abc123`) that point to images held in memory/IndexedDB. This keeps presets small and shareable.

### 4.2 Units: "per grid square"

Sizes that should look the same on the map no matter how big the creature is are stored **per grid square**, not as a percentage of the whole token:

- frame thickness, outer spacing, inner spacing
- decoration size
- label text size and label shape size
- shadow distance and blur
- effect size (e.g. how far flames reach) *(Phase 6: shown as "% of a square", 0–50 %)*

**Unit (Phase 1):** per-square values are stored in *half grid squares* (1 = half a square, so the extension's 0.14 border means the same thing on a Medium token). The UI shows them as "% of a square" (value × 50). The maths lives in `src/document/sizing.ts`.

So a Large (2×2) token's border is exactly as thick on the map as a Medium (1×1) token's — it is not doubled. Image (PNG) frames are the exception: they scale with the token (explain this in their help tip).

Output resolution is chosen as **pixels per square** (e.g. 256 px). Final size = squares × pixels per square (a Tiny token is half a square).

### 4.3 Undo / redo

Every change to the TokenDocument goes through the store, which keeps a history. Ctrl+Z / Ctrl+Y (Cmd on Mac) and on-screen buttons. Slider drags count as one step.

### 4.4 Autosave

The current document (and its images) autosave to IndexedDB, so a refresh or closed tab doesn't lose work. "Start new token" clears it.

---

## 5. Render pipeline (layer order, bottom to top)

The same pipeline draws the preview and the export.

1. **Outer drop shadow** — of the whole token's silhouette (shape + frame + decorations + pop-out parts), falling away from the light (§9).
2. **Backing** — solid fill inside the shape (from the extension), with opacity.
3. **Background layer** — colour, gradient or image, clipped to the inner shape.
4. **Effects placed "behind art."**
5. **Processed art** — clipped to the inner shape. "Processed" means: transform (move/scale/rotate/flip) → adjustments → background removal mask → lighting. This bitmap is computed once and reused in step 12.
6. **Foreground overlays** — gradient, vignette, foliage, mist, lighting overlays, clipped to the inner shape.
7. **Effects placed "over art."**
8. **Inner shadow** — the shadow the frame casts onto the art (on/off, strength, softness).
9. **Frame** — code-drawn or image frame.
10. **Effects placed "on border."**
11. **Decorations.**
12. **Pop-out shadow** — the shadow that pop-out parts cast onto the border.
13. **Pop-out art** — the *same processed art bitmap* from step 5, drawn through the pop-out mask, clipped only to the square output image.
14. **Label.**

*(Phase 8: layer 14, the label, is drawn by `src/render/label.ts`.)*

*(Phase 1: `renderToken(ctx, doc, assets, size)` in `src/render/render.ts` draws layers 1, 2, 5, 8 and 9; the other layers have marked empty slots. The extension drew the drop shadow and the shadow onto the art as part of each frame; here they are separate layers 1 and 8, so they can be switched off, follow the light, and include pop-out parts later. The outer shadow is drawn shadow-only and then cleared under the token, so it never shows through transparent parts.)*

*(Phase 5: the whole render is clipped to the square, so nothing can land outside it even when drawn into a bigger canvas. The pop-out parts are drawn once per render onto a square layer (the processed art with the pop-out mask applied to its alpha, at the processed bitmap's own pixel size, then drawn with the art's transform). That one layer is used three times: in the outer drop shadow's silhouette (layer 1, which is also cleared under it), for the pop-out shadow (layer 12, clipped to the frame band, between its outer and inner edges, because the drop shadow already covers the space around the token), and as the pop-out art itself (layer 13). Decorations will join the same silhouette in Phase 7 — done: they are drawn onto one layer used for layer 11 and in the silhouette.)*

*(Phase 10: drawn frames (layer 9) are drawn onto a layer of their own and the last six are kept (up to 2048 px), so a slider that doesn't change the frame doesn't redraw its texture; larger ones (exports) are drawn and let go. Frames only paint over themselves, so this gives the same picture.)*

Rules:

*(Phase 3: "processed art" is computed in the picture's own pixels, in this order: colour adjustments → background-removal mask → brush strokes on the mask → blur/sharpen → (lighting, Phase 4). The move/zoom/rotate transform is applied when the bitmap is drawn, which gives the same pixels but means dragging the art never recomputes anything. The code is plain pixel maths in `src/image/` (no canvas filters, which Safari lacks), so it runs the same in a Web Worker and in tests. Each stage is cached, so changing Brightness doesn't redo the background flood-fill. While a slider or brush is being dragged, the preview uses a quick 512 px copy; when the drag ends, the Web Worker makes the full-size bitmap (the picture's working size, up to 2048 px), and the export waits for it, so the export always comes from the full-size art.)*

- Pop-out art must be pixel-identical to the inside art where they meet — no seams. That is why both come from one processed bitmap.
- The pop-out mask is stored in the **art image's own coordinates**, so moving, zooming, rotating or flipping the art moves the mask with it.
- Nothing is ever drawn outside the square output image. Pop-out parts may cover the border and the outer spacing, but never leave the square, so the token always lines up 1:1 with grid squares in a VTT.

---

## 6. Features

Every section heading has a **? help tip** (see §11); the controls inside a section show their help as a tooltip on their name.

### 6.1 Importing an image

Ways in (all lead to the same "image loaded" state):

1. **Upload** — file picker (PNG, JPG, WebP, GIF first frame, AVIF, BMP; SVG rasterised).
2. **Drag and drop** — anywhere on the page. Files load directly. Images dragged from another browser tab arrive as a URL/HTML and go through the web-address route.
3. **Paste** — Ctrl+V / long-press paste. Image data loads directly; pasted text that is a URL goes through the web-address route.
4. **Web address** — a text box.
   - A **direct image link** loads straight away.
   - A **normal web page** link: the server fetches the page and returns the images found on it (`<img>`, `srcset` largest, `og:image`, `twitter:image`, CSS backgrounds where easy). The user picks one from an image strip (like the extension's Image section). Tiny images (icons, under ~64 px) are hidden.
   - If a site blocks fetching, show a friendly message suggesting right-click → "Copy image address", or downloading and uploading.
5. **Pinterest pin link** — paste a pin URL (including `pin.it` short links). The server follows redirects, reads the pin page's main image (`og:image`, preferring the `/originals/` size) and loads it. (Browsing Pinterest boards with login is a future feature — §15.)

The import file's name (without extension, tidied) becomes the token name; the user can edit it. *(Phase 1: separators become spaces, all-lowercase names get capital letters, and generic names such as "image.png" from a paste keep the current name. Phase 2: web images are named from the picture's file name (size suffixes like "-1024x768" and meaningless names such as hashes or "IMG_2041" are dropped), else its alt text, else the page or pin title.)*

*(Phase 2: the web-address box is in the Import section. Addresses without `https://` get it added, and `http://` is upgraded. An address that ends like an image file is tried as an image first; if it turns out to be a page, the page route is used. A page with only one picture loads it straight away. Thumbnails in the picture strip load straight from the site (no referrer), falling back to the proxy, and any that fail or turn out smaller than 64 px are hidden. Pasting or dropping a link opens the Import section (the Import tab on phones). When an image is dragged from another tab, its `<img src>` is used rather than the link around it; `data:` images load directly.)*

*(Phase 10: first-time experience — the empty token shows a small card in its middle with **Upload image**, **Try a sample** and three steps (Add a picture · Style it · Download for your VTT). The sample is the goblin drawn by `scripts/make-fixture.ts` (`public/sample/goblin.png`), imported exactly like an upload and named "Goblin".)*

**Batch mode** (optional switch): import several images at once (multi-select upload, multi-file drop, or several links). One shared style applies to all; each image keeps its own position/zoom/rotation and name. A thumbnail strip switches between them. Export all as a ZIP (§6.11).

*(Phase 9, as built: `src/batch/batch.ts`. The editor still edits one TokenDocument — the token on screen — and the batch keeps, for every picture, only what belongs to it (`BatchItem`): the picture (asset id), its transform (move, zoom, rotation, flips), the eyedropper's picked colour, its erase/restore strokes and pop-out strokes, its name and the label's own words (`label.text`). Everything else is the shared style read from the one document, so any token is `docForItem(doc, item)`; adjustments and the removal/pop-out settings are shared, the brush work is not. Switching pictures keeps the undo history for the style: past and future steps get the new picture's own parts, and steps that only changed the previous picture's own parts are dropped, so Undo after switching undoes the last style change, never the switch. Turning Batch on makes the token on screen the first picture; while on, every import (upload with several files, a drop of several files, paste, one or several links separated by spaces or lines — a page with several pictures stays open to pick from, and each pick joins the batch) adds a picture, which starts with the usual initial crop for the current frame. The first is shown; the rest wait in the strip. Turning Batch off (after a confirmation) keeps only the token on screen; New clears the whole batch. Up to 50 pictures. The batch is autosaved with its pictures. The strip — thumbnails drawn by the renderer with a small copy of each picture, a few per frame, plus Add and Remove — sits along the bottom of the canvas area on desktop and tablet, and under the floating toolbar on phones, so the bottom sheet never covers it.)*

### 6.2 Basic image editing

- **Always visible:** Brightness, Contrast, Saturation.
- **Advanced dropdown:**
  - Colour: Hue, Temperature, Tint
  - Light: Exposure, Highlights, Shadows
  - Detail: Sharpness, Blur
  - Style: Vibrance, Grayscale, Sepia, Invert
- **Background removal (flat colour):** the extension's method — pick the background colour automatically (from the edges) or with an eyedropper; **Intensity** slider (how similar a colour must be to be removed) and **Edge softness** slider.
- **Erase / restore brush** to fix mistakes: brush size, softness, and a simple mode where the user just drags one slider. Works with touch and pen. The removal result is stored as a mask (not by destroying pixels), so it can be changed later. **While the brush is active, the frame (and anything else over the art's edge) is drawn at 50% opacity** so the user can see what they are painting underneath it; the export is unaffected.
*(Phase 3, as built:*
- *Slider ranges: -100…100, except Hue (-180…180°) and Sharpness, Blur, Grayscale, Sepia (0…100). Invert is an on/off switch. Brightness, Contrast and Saturation use the extension's formulas. Exposure works in stops (±2), Highlights/Shadows change only bright/dark tones, Vibrance boosts dull colours most. Blur is measured on the picture (100 = 2 % of its longer side), so preview and export match at any resolution. A **Reset adjustments** button clears them.*
- *Background removal: the colour is the most common colour around the picture's edges (or one picked with the eyedropper, which then switches back to moving the art). Flood-fill from the edges, as in the extension, so same-coloured areas inside the character are kept; Intensity uses the extension's tolerance scale; Edge softness blurs the mask edge (up to about 1 % of the picture). Adjustments and removal settings carry over when a new picture is imported; brush strokes and a picked colour don't.*
- *Brush: strokes are stored in the document as points in the picture's own 0–1 coordinates (with pen pressure), so they follow the art, redraw at any resolution, autosave, and undo like everything else (one stroke = one step). The simple control is one **Brush size** slider (in screen pixels); Advanced adds Softness, Pen pressure and "Show removed parts in red". While the brush is on, removed parts are tinted red inside the frame's opening (editor only, never exported), the move/scale handles are hidden, two fingers still pan/zoom, and a small bar on the canvas offers Erase/Restore and Done. On phones the bottom sheet lowers while the brush or eyedropper is on and comes back up on Done. Brush settings are remembered in localStorage.)*

- **Transform:** drag to move, **on-canvas handles** for scale and rotate (pinch and two-finger rotate on touch), the toolbar's zoom slider, flip horizontal/vertical, fit, fill, reset. *(Phase 1: four corner handles resize the art around its centre and a round handle above it rotates it (hold Shift to snap to 15°). Handles stay on screen even when the art's corners are off the canvas. A whole drag or pinch is one undo step.)*
- **View zoom (changed after Phase 1):** the **mouse wheel over the token or the art zooms the view**, not the art: the whole token gets bigger on screen (up to 800%, around the pointer) for close-up work such as brushing. Hold Space or the middle mouse button and drag to look around; a "View n% · Reset" button brings the whole token back. Handles that end up off screen are hidden while zoomed. The view isn't saved and resets for a new image. The **wheel anywhere else over the canvas scrolls the side panel**. The extension's "Keep the frame filled" option was dropped: the art moves freely by default and Fill covers the frame on demand.

### 6.3 Background

Options (one at a time):

- **Colour** — swatches + colour picker, opacity.
- **Gradient** — simple: two colours, linear or radial, angle. Advanced: full editor with any number of stops, positions and opacity.
- **Image** — from the built-in library (forest, dungeon stone, parchment, night sky, lava, water, tavern wood, snow, swamp…), the user's own image (same import methods as §6.1), or **the token's own art** (an enlarged copy).
- **Blur** slider for any background image (gives the "blurred copy of the art" look when used with the token's own art).

The background is affected by its own position/zoom, independent of the art.

*(Phase 4, as built: `background` in the document keeps every kind's settings (colour, gradient, picture), so switching kinds never loses work, plus an opacity for all kinds. Gradients have a type (linear/radial), an angle and 2–16 stops, each with position, colour and opacity; the same editor is used by the Gradient overlay. A picture is `{type: 'library', id}`, `{type: 'asset', assetId}` (the user's own, autosaved like the art) or `{type: 'art'}` (the art's original picture, defaulting to 130% zoom and some blur). It covers the frame's opening at zoom 100%; zoom (50–400%) and offset move it, using a "Move on the canvas" tool. Blur 100 = 5% of the picture's longer side, worked on a 640 px copy and cached. The built-in library is 10 pictures drawn by code (`scripts/make-backgrounds.ts` → `public/backgrounds/*.webp`, loaded when first used and never autosaved). Your own background picture can come from upload or a pasted link (the Phase 2 web importer, with a target); drag-and-drop and Ctrl+V on the page still always set the art.)*

### 6.4 Foreground overlays (merged into Effects after Phase 10, document v8)

Stackable list, drawn over the art and inside the frame:

- **Gradient** (same editor as §6.3)
- **Vignette** (colour, size, softness)
- **Foliage / smoke / mist / cobwebs** — from free-to-use (CC0) art packs where possible, otherwise drawn by code
- **Shadow** (darken one side/edge)
- **Lighting** — see §6.5

Each overlay: opacity, blend mode (normal, multiply, screen, overlay, soft light), position/scale where it makes sense.

*(Phase 4, as built: overlays are a list in the document, drawn bottom first; the panel shows the top first with up/down, hide and remove buttons, up to 12. Kinds: Gradient, Vignette (colour, size, softness), Edge shadow (colour, side, reach, softness), Mist (colour, side, reach, softness, scale), Smoke (colour, amount, softness, scale), Foliage (colour, side it grows from, reach, leaf scale) and Cobwebs (colour, corner, size, scale). All are drawn by code with a seeded random layout ("Shuffle" picks another), so a token looks the same every time and at every size; each is drawn once into its own canvas and reused. Lighting is its own section (§6.5) rather than an overlay.)*

### 6.5 Lighting

- **Directional light:** a direction dial, colour, strength; optional **rim light** (a thin bright edge on the subject, best with a removed background).
- **Presets** that set the directional light, then remain editable: Torchlight (warm, from below), Moonlight (cold, from above), Holy glow, Fel green, Firelight flicker look, Underdark (dim purple).
- Lighting is part of "processed art" (§5), so pop-out parts are lit identically.
- The light direction drives shadow direction (§6.7).

*(Phase 4, as built: `lighting` holds direction (degrees the light comes from: 0 right, 90 below, 225 top left), on/off, the preset last picked, colour, strength, "darkness away from the light" (falloff), rim light (on, strength, width) and "light the background too". Presets switch the light on and set direction, colour, strength, falloff and rim; any change by hand keeps the light but clears the preset's name. On the art, lighting is the last processed-art step (`src/image/lighting.ts`): the side away from the light darkens, the colour is tinted towards the light's hue (normalised, so a dark colour still tints), and the near side brightens and glows; the rim lights pixels whose neighbour towards the light is see-through (so it follows a removed background's edge). *(Phase 7: rim softness 0–100 — at 0 the rim is a crisp band; higher values fade it with the distance from the edge and let it reach a little further.)* The direction is turned into the picture's own coordinates, so rotated or flipped art is lit from the right side. The background gets the same kind of light with canvas gradients. The dial is always shown because shadows already follow it; the shadow controls are Phase 5.)*

### 6.6 Pop-out (art over the border)

- The user paints a **pop-out mask** with a brush (add/erase, size, softness) over parts that should be drawn on top of the border — a head, horns, a sword.
- Pop-out parts get exactly the same adjustments, background removal, lighting and effects as the art inside (no seam).
- Moving/zooming/rotating the art keeps the mask aligned.
- Pop-out parts may extend over the border and outer spacing but are clipped to the square output.
- Show the mask as a coloured overlay while painting; a toggle hides it.

*(Phase 5, as built: the Pop-out section has a **Paint pop-out** button (a canvas tool like the erase/restore brush, with Add / Erase / Done on the canvas), Add/Erase, brush size, "Show the pop-out mask", **Pop-out on** (off keeps the painting but draws nothing over the border) and **Clear pop-out**; Advanced holds softness and pen pressure. Size, softness and pen pressure are shared with the erase/restore brush; the mode and the mask toggle are remembered in localStorage. The mask is tinted teal over the whole art (not only inside the frame, since pop-out parts reach past it), and while painting the frame is drawn at 50 % like the other brush. Strokes are stored like the erase/restore strokes, in the picture's 0–1 coordinates, and drawn into a mask at the picture's working size (up to 2048 px), only redrawing the newest stroke while painting. A new picture starts with an empty pop-out mask. Changing the pop-out never recomputes the processed art.)*

### 6.7 Shadows

- **Outer drop shadow** (outside the token).
- **Pop-out shadow** (cast by pop-out parts onto the border).
- **Inner shadow** (the frame's shadow onto the art): on/off, strength, softness.
- Outer and pop-out shadows **follow the light direction by default**; an "unlink" toggle reveals angle, distance, blur, colour and opacity.

*(Phase 5, as built: the shadow controls are in the Lighting & shadows section, under the light: Drop shadow, Pop-out shadow and Inner shadow, each with an on/off switch. Drop and pop-out shadows have "follow the light"; switching it off shows a direction dial (the way the shadow falls, starting from where it was, so nothing jumps), distance, blur, colour and opacity. Distance, blur and inner-shadow softness are per square and shown as "% of a square". The inner shadow has strength and softness and falls the same way as the drop shadow.)*

### 6.8 Styles & effects

Stackable, reorderable list. Each effect chooses its placement: **behind art**, **over art** or **on border**. Each has an **Intensity** slider up front; the Advanced dropdown adds colour, size, spread and **Shuffle** (random variation, stored as a seed so it's repeatable).

- **Glows:** inner glow, outer glow (any colour — arcane blue, radiance gold, etc.).
- **Elemental:** fire, frost, poison, lightning, necrotic, radiant.
- **Condition looks** (one-click variants useful in VTTs): bloodied, petrified (stone), ethereal/invisible (faded), frightened, poisoned, charmed, unconscious.
- **Atmosphere:** mist, embers, sparkles, smoke.

All version-1 effects are static images (animation is a future feature, but design effects with a time parameter so animation can be added later).

*(Phase 6, as built: `effects` in the document is a list (schema version 5), drawn bottom first within each placement — behind the art is layer 4, over the art layer 7, on the border layer 10 — and shown top first in the panel with up/down, hide and remove, up to 12. Each effect stores its kind, placement, Intensity (0–100), colour, size (per square, shown as "% of a square"), spread (0–100) and a Shuffle seed; every kind starts with its own placement and settings (glows and elements on the border; conditions and atmosphere over the art). Everything is drawn by code. Rules that apply to all of them:*
- *Behind and over the art, an effect lives inside the frame's opening and grows in from its visible edge (the art runs under the inner half of the frame, so not from there); there is more room inside, so things reach 1.6× further in than they stick out of a border. On the border it grows from the middle of the frame band out (and over the band), and fades out just before the square's edge so nothing stops dead there; without a frame a thin band at the art's edge stands in. Tints (petrified, ethereal, frightened, poisoned, unconscious, the glows' inside parts) stay inside the opening or on the band.*
- *Spread: how much of the token it covers. Rising things (fire, mist, smoke, frost, necrotic) start at the bottom and creep further round as it grows; for glows it is how solid the glow stays before fading (like Photoshop's "spread"); for particles it is how many.*
- *Outer glow behind or over the art follows the art's own outline (a halo round a cut-out creature); on the border it glows round the token. Inner glow shines in from the frame's edge (or lights the band on the border).*
- *Condition looks change what is under them with blend modes: petrified uses the "colour" blend with a stone colour plus a stone texture and cracks; ethereal erases part of what is under it (more at the bottom), so the exported token is really see-through; frightened and poisoned tint with the "colour" blend; unconscious desaturates and dims, with a "Zzz". Bloodied is splatters with drips.*
- *Each effect is a function of (settings, size, seed, time) — `src/render/effectPainters.ts` — returning one or more passes, each with a blend mode. A pass is drawn once into its own canvas and cached (about 100 MB at most; very large exports are drawn fresh), then composited at the Intensity, so dragging Intensity redraws nothing. Time is in seconds and always 0 for now; fire flickers, embers and bubbles rise, sparkles twinkle and lightning re-strikes as it changes, ready for animation (§15).*
- *The picker shows a live thumbnail of every effect, drawn by the renderer on the token's own shape and frame with a stand-in cut-out figure, and each name has a help card with a before/after picture made by `npm run help-images`.)*

### 6.9 Borders, decorations, presets and size

**Frames**

- **Code-drawn frames:** all 5 shapes and 27 frames from the extension, with colour, thickness, outer spacing, inner spacing, backing colour and backing opacity. Frames are always fully opaque. Frames with details in a fixed colour of their own (Monk's jade beads, Warlock's eyes, Paladin's gold crosses, Rogue's stitching, Ranger's red fletching, Bard's notes, Starfield's stars) also get a **Frame highlights colour** control; it shows only for those frames and resets to the frame's default when another frame is picked.
- **Image (PNG) frames:** a built-in set plus user uploads. On upload, the site finds the frame's hole automatically (the transparent area connected to the centre) and uses it as the art's clipping shape; the user can nudge it if needed. Uploaded frames are kept in IndexedDB. Image frames scale with the token.

**Decorations** (gems, skulls, horns, wings, ribbons, laurels, class icons, stars, chains, etc.)

- Snap points (top, bottom, left, right, diagonals) with optional **mirroring** (a matching left/right pair), or free drag anywhere.
- On-canvas handles to resize and rotate; colour tint and opacity.
- Sizes are per grid square (§4.2).

**Creature size**

Tiny, Small, Medium, Large, Huge, Gargantuan, Custom (any number of squares). Changing size keeps per-square things (frame thickness, label size…) the same on the map.

**Presets**

- **Built-in presets** combining frame, colours, effects, lighting and label style (e.g. Boss, Undead, Party member, Minion, Fey, Fiend, Celestial, Construct).
- **Save your own** (in the browser, IndexedDB).
- **Share:** export a preset as a small `.tokenpreset.json` file (or copyable text code) and import someone else's.
- Presets never contain the user's art. Preset files carry `schemaVersion` and are migrated on import.

*(Phase 7, as built:*
- *Picture frames: `frame.image` holds the source (`library` id, or `upload` id in the `token-maker-frames` IndexedDB database), the hole as a polygon in token units, how far the picture's solid parts reach (`outer`, for effects on the border and snap points) and the user's nudge (move x/y, scale around the hole's middle). The hole is found when a frame is picked: flood-fill of the see-through area joined to the middle (stepping past a gem covering the very middle), then 120 rays from its middle to where it ends, ignoring single thin spikes, grown by 1.2 % so the art runs under the soft inner edge. A frame open to its edge is flagged and the rays stop at the first solid pixel; one with no hole gets a stand-in circle. The picture fills the token's square (fitted), so it scales with the token. The hole is the art's clipping shape everywhere (art, background, overlays, crop maths, backing); the inner shadow falls from everything outside it; the pop-out shadow lands only where the picture is solid; the drop shadow follows the picture's outline. Switching between Drawn and Picture keeps both kinds' settings. 8 built-in frames are drawn by `scripts/make-frames.ts` into `public/frames/`.*
- *Decorations: 18 kinds drawn by code, each upright as at the top of the token, facing outwards, with its own anchor point. A decoration is snapped (`top`, `topRight` … `topLeft`: on the middle of the frame band, or a picture frame's band, turned to face outwards, with `rotation` on top) or `free` (x, y in token units). Mirroring draws the reflection across the up-down middle line (x → −x, rotation → −rotation, flipped), skipped when it would land on itself. Size is the picture's height per square. Up to 16. They are drawn onto one layer that also joins the drop shadow's silhouette. On the canvas a tap picks the top-most one (mirrored copies too) and drags it; within 0.14 of a snap point it snaps there (Alt places it freely); the picked one gets a resize and a rotate handle, and `Delete` removes it.*
- *Presets: a look = shape, background (minus the user's own picture), overlays, lighting, effects, frame, decorations, shadows and label (its text stays the token's). Applying one is one undo step and keeps the art, its edits, the name and size. Files are `.tokenpreset.json` (`schemaVersion` = preset format, `docVersion` = the document version the look came from; the look goes through the document migrations). Text codes are `TKP1.` + URL-safe base 64 of the deflate-compressed preset (`TKP0.` uncompressed where a browser can't compress). Shared files and codes carry the picture of an uploaded frame they use as a `data:` URL, saved into the importing browser's frames. Saved presets live in the `token-maker-presets` IndexedDB database. Built-ins (Boss, Undead, Party member, Minion, Fey, Fiend, Celestial, Construct) are changes to the starting token in `src/presets/builtins.ts`.)*

### 6.10 Label

- Shapes: **banner/ribbon**, **plaque**, **pill**, **box** (rounded or sharp corners), and **curved text on the ring** (no backing shape).
- **Free position:** drag anywhere; snaps to bottom/top by default.
- Shape colour, opacity, outline. Text: content (defaults to the token name), font, size, colour, outline, shadow, letter spacing, bold/italic, alignment.
- Fonts: a curated set of ~15 free fantasy-suitable fonts with open licences (e.g. Cinzel, Cinzel Decorative, IM Fell English, MedievalSharp, Pirata One, UnifrakturMaguntia, Uncial Antiqua, Almendra, Metamorphous, Grenze Gotisch, Macondo, Alegreya SC, Spectral, Germania One, Eagle Lake), **bundled with the site** (not loaded from Google at runtime) so exports never use a fallback font. Users can upload their own `.ttf/.otf/.woff/.woff2`, kept in IndexedDB.

*(Phase 8, as built:*
- *`label` (schema version 7) holds the shape (`banner`, `plaque`, `pill`, `box`, `ring`), `text` (null = the token's name, so it follows renames), `place` (`top`, `bottom` or `free` with x, y in token units; ring text uses `angle` round the ring and `arc`, the most of the ring it may cover), width, banner `curve` (−100…100, positive bends the ends up), box `corners`, shape fill/opacity/outline, font, size, colour, bold, italic, letter spacing (share of the text size), alignment, text outline, text shadow and `shrinkToFit`. Text size, shape width and outline widths are per square.*
- *Drawn last (layer 14) by `src/render/label.ts`. Text is laid out letter by letter along a path (kerning kept by measuring prefixes), so straight, bent-banner and ring text share one code path; straight text with no extra spacing is drawn in one go to keep the font's joined letters. Ring text follows the middle of the frame band — the token's shape or a picture frame's hole — and runs the other way round along the bottom so it reads upright. Snapped shapes sit on the band's middle at the top or bottom and are nudged to stay inside the square. Shrink-to-fit scales the text to the room on the shape (or `arc` of the ring); switched off, the shape grows to fit (never wider than the token). The shape is shaded lighter at the top, drawn on its own layer for even opacity, and casts a small version of the token's drop shadow; the text shadow falls away from the light.*
- *Fonts: 15 OFL fonts from `@fontsource` (latin letters; real bold and italic files where the font has them, otherwise the browser thickens or slants it), registered with the FontFace API under our own family names (`tm-<id>`) so a copy installed on the computer is never used. They load when the Label section or a label needs them; the export waits for the label's font. Uploaded fonts live in the `token-maker-fonts` IndexedDB database and are `upload:<id>` in the document; a preset that uses one carries the file (as a `data:` URL with its name) when shared. A preset carries the label's style but not its words.*
- *Editor: tap or drag the label on the canvas (it is picked before decorations); it snaps to the top or bottom within 0.15 of the snap point (ring text within 12°), Alt places it freely. Moving a banner between top and bottom flips its bend.)*

### 6.11 Export

- **Formats:** PNG (transparent), WebP (transparent, smaller), JPG (no transparency — ask for a fill colour). GIF reserved for animated tokens later.
- **Resolution:** pixels per square — 128, 256 (default), 400, 512, or custom; show the final pixel size; cap the long side at 4096 px.
- **File name:** from the token name, editable; safe characters only.
- **Download** and **Copy to clipboard** (PNG; if the browser can't copy images, say so and offer download).
- **Batch:** a ZIP of every token in the batch, each with its own name.
- The export is produced by the same renderer as the preview.

*(Phase 9, as built:*
- *The Export section: Format (PNG / WebP / JPG; JPG shows a Fill colour, default white), Pixels per square (128, 256, 400, 512, Custom 32–4096 with a slider and typed number) with the final size shown ("capped" when the 4096 px limit applies), File name (starts as the token's name; only letters, numbers, spaces, `-` and `_` can be typed, accents are dropped, spaces become `-`; a typed name applies to that token name only, so a new picture or a rename goes back to following the name), Download, Copy to clipboard and, in batch mode, Export all as ZIP. Advanced: Quality (WebP and JPG, default 92 %). These choices are about the file, not the look, so they live outside the document (`src/export/exportSettings.ts`, remembered in localStorage; never in presets or undo). The bottom bar's Export button and the size shown under the token use the same choices; in batch mode with more than one picture it becomes "Export all (n)".*
- *`renderForExport` draws `render(doc, assets, side)` and, for JPG, lays it on the fill colour; `encodeCanvas` asks the browser for the format and quality and reports when the browser quietly writes PNG instead (Safari can't write WebP), suggesting PNG or JPG. Copy is always PNG (the one picture type clipboards take everywhere) and the clipboard item is made during the click with the picture still on its way, as Safari requires; browsers that can't copy pictures get a message pointing to Download.*
- *Phones: the full-size processed art is made by the art Web Worker before rendering (as before), the browser encodes the file off the main thread, and a ZIP is packed by its own Web Worker (`src/export/zip.worker.ts`, fflate, files stored without recompressing since PNG/WebP/JPG are compressed already; on the main thread where workers aren't available). Rendering the token itself stays on the main thread (it needs the page's fonts, pictures and caches), one token at a time with a pause between tokens, and each canvas is emptied as soon as it is encoded; pictures not on screen drop their full-size processed art after their turn. A progress card shows "Token 3 of 6" with a bar and a Stop button.*
- *ZIP files are named after each token (`uniqueFileNames`: "-2", "-3"… for clashes, ignoring case) and the ZIP is `tokens.zip`.*
- *GIF and other animated formats: not built. `src/export/animated.ts` explains where they plug in (a time in `RenderOptions`, `frameTimes()`, an encoder in a Web Worker, a new entry in `FORMATS`).)*

### 6.12 Frame Studio designs as frames (document v9)

[Frame Studio](https://github.com/GroudonMcL/Frame-Studio) is the owner's visual editor for code-drawn frames. Its designs open here as a third **Frame type**, beside Drawn and Picture.

- **Shared code, one renderer.** `src/frameStudio/` is Frame Studio's project reader and renderer (`src/project/`, `src/render/`, `src/share/` there), copied by Frame Studio's `npm run share:export -- ../token-maker` with `src/frameStudio/SOURCE.json` (its commit and each file's SHA-256). The only change made while copying: imports of Frame Studio's copy of this site's frame engine point at `src/render/` here, the code it was copied from. **Never edit these files here**; `src/frameStudio/frameStudio.test.ts` fails if one was. Change Frame Studio and export again (`npm run share:check -- ../token-maker` lists what differs). They follow Frame Studio's lint rules (`eslint.config.js`).
- **In the document:** `frame.kind: 'design'` and `frame.design: { id, name, project }`. The whole design (a few kilobytes of JSON) is kept in the document, so the renderer stays a pure function of the document, and undo, autosave, batch mode and presets need nothing new. Reading a document checks the design with Frame Studio's own reader (`readFrameDesign`: any version Frame Studio has saved, every field checked, nothing in it ever run); a design that isn't one is dropped. **v8 → v9** adds `design: null`, so old tokens are unchanged.
- **Drawing:** layer 9 draws the design with `drawFrameDesign(ctx, project, geometry)` on the same `FrameGeometry` as a drawn frame (token shape, `frameOuter`/`frameInner` from `computeInsets`), on the cached frame layer. So the band follows **Thickness**, **Outer spacing** and **Inner spacing** per square, like a drawn frame, and the inner shadow, effects on the border, pop-out shadow and decorations treat it as a drawn frame. The design is lit from the light it was made with (Frame Studio's light dial). Frame type set to Frame Studio with no design opened draws no frame. `computeInsets` always gives a design a band (a drawn frame's "No frame" style doesn't apply).
- **In the panel (Frame & shape → Frame type → Frame Studio):** Shape; the designs opened in this browser as tiles (drawn by the real renderer on the token's shape); **Open a Frame Studio design** (a `.framestudio.json` file, up to 5 MB; refused with Frame Studio's reason if it isn't one; warnings shown); **Remove from this browser**; Thickness, Outer spacing and Inner spacing.
- **Photo textures** (Frame Studio format 10): a design can use Frame Studio's photo textures, which its renderer draws as their average colour until loaded. `ensurePictures` (`src/state/pictureLibrary.ts`) loads a design's photos with the token's other pictures (`loadFrameDesignPictures`), when the frame changes and before every export; when one arrives the asset map is renewed so the stage and thumbnails draw again, and the frame layer's cache key includes Frame Studio's `pictureEpoch()`.
- **Kept in this browser:** the `token-maker-designs` IndexedDB database (`src/state/designLibrary.ts`) holds each opened file's text, read again (and so migrated) by Frame Studio's reader. "New token" never deletes it. A token keeps working without it, since the design is in the document.
- **Presets:** a look with a design carries it (it is part of `frame`). Installing a shared preset also adds its design to that browser's designs, as uploaded frame pictures are.
- **Tests:** `src/render/designFrames.test.ts` draws designs saved by Frame Studio (versions 2 and 3, Paladin as editable layers lit from the bottom right, every themed border, and a design with photo textures, game-icons ornaments and paint fills once its photos have loaded) through `renderToken` and through Frame Studio's own `renderProject` on a band of the same shape, thickness and spacing, and checks they are the **same picture, pixel for pixel**, on every shape and at other thicknesses, spacings and token sizes. Also the migration and checks, the panel, presets and the library, and end-to-end on desktop, tablet and phone (open two designs, pick one, thicken the band, reload, export).

---

## 7. Server: the image proxy (Cloudflare Pages Functions)

Only two endpoints. No storage, no logging of image content.

- `GET /api/fetch-image?url=…` → returns the image bytes (with correct content type).
- `GET /api/page-images?url=…` → returns JSON: a list of image URLs found on the page (with width/height hints), or a Pinterest pin's main image.

Security rules (port from the extension's `server/`):

- `https:` only (also for every redirect hop); max ~5 redirects.
- Refuse private/loopback/link-local IPs and local hostnames.
- Size cap (e.g. 20 MB images, 3 MB HTML), timeout (~10 s).
- Sniff content: images must really be images.
- Rate-limit per IP (simple, e.g. Cloudflare's built-in rules or a small in-memory limiter).
- Not an open proxy for arbitrary content: only images and HTML for image discovery.

*(Phase 2: the code lives in `server/`, shared by `functions/api/*` and the Vite dev server. Rules as built: https only on the default port, no user names or passwords in addresses, at most 5 redirects with every hop checked, IP literals in private/reserved ranges and local names (`localhost`, no dot, `.local`, `.internal`, `.lan`, `.home.arpa` …) refused, 10 s for the whole request, 20 MB images and 3 MB HTML, images sniffed by their bytes (PNG, JPEG, GIF, WebP, AVIF, BMP, SVG) and sent with the sniffed type plus `Content-Security-Policy: sandbox` and `nosniff`, nothing cached by shared caches. Requests that browsers mark `Sec-Fetch-Site: cross-site` (other websites) are refused. Rate limit: an in-memory one-minute window per IP of 20 page look-ups and 90 images; it is per Cloudflare location, so a dashboard rate-limiting rule can be added on top. The dev server also looks up every hostname in DNS and refuses private addresses, because a home computer, unlike Cloudflare, can reach a private network. Image discovery skips scripts, styles, comments, SVGs, favicons, sprites and trackers, puts og:image first, and lists at most 60 images. Pinterest: pin pages give a reduced og:image; the full-size `/originals/` copy is found in the page data by the same path (its file type can differ from the preview's), with the og:image as a fallback; board and search links get a message asking for a single pin's link.)*

---

## 8. Layout and responsiveness

Desktop and phone are **equally important**.

**Desktop (≥ 1024 px):** top bar (logo, Batch toggle, Undo/Redo, New) · large canvas in the centre with a floating toolbar (zoom slider, rotate, flip sideways, flip upside down, fit, fill, reset) · right-hand panel of collapsible sections · bottom bar with token thumbnail, name, size, final pixel size, **Export** button.

**Phone (< 768 px):** canvas fills the top part of the screen; a **bottom sheet** with icon tabs for each section (Import, Image, Background, Foreground, Lighting, Effects, Frame, Decor, Label, Export) that can be dragged up/down; big touch targets (≥ 44 px); pinch to zoom, two-finger rotate; brushes work with finger and pen.

*(Phase 10, phone pass: every control is at least 44 px to touch on touch screens — slider and hex number boxes, swatches, segmented buttons, small buttons, list cards and the logo; segmented rows wrap rather than squeeze; the floating toolbar scrolls sideways rather than shrinking its buttons (on narrow phones its zoom readout is hidden); the sheet's grab handle reaches 24 px up over the canvas. When the bottom sheet is half or fully open the token moves up into the space above a half-open sheet instead of hiding behind it. `e2e/phase10.spec.ts` checks every control in every phone tab.)*

**Tablet:** desktop layout with a narrower panel, or phone layout in portrait. *(Phase 0: from 768 px wide the desktop layout is used with a 290 px panel; below 768 px the phone layout is used.)*

**Phone tabs → sections** (Phase 0): the ten phone tabs hold the thirteen sections like this: Image = Image + Pop-out; Frame = Frame & shape + Size + Presets; every other tab holds the one section of the same name. On phones, the token summary and the Export button sit at the top of the bottom sheet instead of in a separate bottom bar.

**Panel sections** (in this order, changed after Phase 10 at the owner's request): Import · Image (adjust, brush) · Background (background removal, then what's behind the art) · Frame & shape · Pop-out · Lighting & shadows · Effects (including the overlays that were the Foreground section) · Decorations · Size · Label · Presets · Export. A Simple / Advanced / Expert menu-style switch above Import hides, folds or shows the Advanced settings.

**One section open at a time:** opening a section closes the others, to cut clutter and scrolling (in the side panel, and between the sections that share a phone tab). Import is open to begin with.

**Ad slot:** reserved space **below the editor** (the user scrolls down to see it), never covering the tool, behind a feature flag that is **off** for version 1. When on, a small notice explains ads keep the site free. *(The flag is `VITE_FEATURE_ADS=true`, read in `src/config/features.ts`.)*

**Theme button:** the top bar also has a small theme button (System → Dark → Light), added in Phase 0.

---

## 9. Visual design

**Direction: "Lamplit Workbench" with a moonlit sky** (chosen in Phase 0). A tinkerer's bench at night: warm charcoal surfaces, one brass/gold accent, and a deep navy tint that fades down from the top of the screen. The token is always the brightest, most saturated thing on screen. Dark is the default theme. Light theme follows the system setting, or the user can pick it with the theme button in the top bar.

The single source for every value below is `src/styles/tokens.css`. Change values there, not in components. `src/styles/contrast.test.ts` fails if a theme drops below WCAG AA contrast.

**Fonts** (bundled through `@fontsource`, never loaded from Google at runtime)

| Role | Font | Use |
|---|---|---|
| Display | Grenze 500/600 (SIL OFL) | Logo, section titles, page headings |
| UI | Atkinson Hyperlegible 400/700 (SIL OFL) | Every control, label and body text. Chosen because it is very easy to read. |

Type scale: 12 / 13 / 15 (body) / 18 (section titles) / 22 / 28 px.

**Colours**

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg-top` | `#0f1a2e` | `#dbe3ef` | Navy tint at the top (top bar, start of the page gradient) |
| `--bg` | `#16130f` | `#efe9df` | Page background (end of the gradient) |
| `--bg-gradient` | navy → `#141721` → charcoal | pale blue → warm parchment | Page background, top to bottom |
| `--surface` | `#211d18` | `#f8f4ee` | Panels, bars, bottom sheet |
| `--surface-raised` | `#2a251f` | `#ffffff` | Buttons, help cards, hovered rows |
| `--surface-sunken` | `#110f0c` | `#e3dbcd` | Canvas edges, input boxes |
| `--border` / `--border-strong` | `#3a332a` / `#574c3e` | `#d3c8b6` / `#b3a58e` | Dividers / control outlines |
| `--text` | `#f1e9dc` | `#2a221a` | Main text |
| `--text-muted` | `#b3a794` | `#5f5242` | Secondary text (AA on all surfaces) |
| `--text-faint` | `#8a7f6f` | `#7d6f5c` | Large text / decorative only (3:1) |
| `--accent` | `#d6a24e` | `#8f5d12` | Brass/gold: primary button, selection, active tab |
| `--accent-hover` | `#e3b469` | `#7a4f0e` | Hover on accent |
| `--accent-soft` | gold 18% | gold 14% | Selected-tile and badge fills |
| `--on-accent` | `#1a1206` | `#fffaf2` | Text on the accent |
| `--focus` | `#f0c470` | `#8f5d12` | Keyboard focus ring |
| `--danger` / `--success` | `#e07a6a` / `#8cc58a` | `#a8402f` / `#3d7a3b` | Errors / confirmations |

**Spacing** (4 px grid): 4, 8, 12, 16, 24, 32, 48 px (`--space-1` … `--space-7`).

**Radii:** 6 px (small controls, swatches), 10 px (buttons, cards), 14 px (bottom sheet, large panels), pill (floating toolbar, badges).

**Shadows:** `--shadow-sm` (buttons), `--shadow-md` (floating toolbar), `--shadow-lg` (help cards, bottom sheet). Darker and stronger in dark theme, warm brown and soft in light theme.

**Sizes:** controls are at least 32 px tall with a mouse and **44 px on touch screens** (`--hit`). Top bar 52 px, bottom bar 56 px, side panel 360 px (290 px on tablets).

**Components** (in `src/components/`, demonstrated at `/kit`): collapsible `Section` with an `Advanced` sub-drop-down, `Slider` (shows its value, accepts typed numbers, one undo step per drag, and a small notch under the track marking the default value), `ColorSwatches` (swatches + picker + hex box), `SegmentedButtons`, `TileGrid` (grouped picture tiles, like the frame picker), `ImageStrip`, `Toggle`, `HelpTip`. Every one takes a required `helpId`.

**Motion:** 120 ms for hovers, 220 ms for opening and closing, all switched off for `prefers-reduced-motion`.

**Logo:** a placeholder gold ring with a star (`src/layout/BrandMark.tsx`, `public/favicon.svg`) until the final name and logo are decided.

---

## 10. Accessibility

- Every control reachable and usable by keyboard; visible focus.
- Sliders show values, accept typed numbers and mark their default value with a notch.
- Help tips readable by screen readers; don't rely on hover alone (tap/click to open on touch).
- Respect `prefers-reduced-motion` (help GIFs paused, show a still).

*(Phase 10, as checked: axe (WCAG 2.1 A and AA) finds nothing in the editor with every section and its Advanced parts open, nor on the About, Privacy and UI kit pages, in the dark and light themes, on desktop, tablet and phone; every stop along the Tab order shows a focus ring; a token can be styled with the keyboard alone (sections open with Enter, choices move with the arrow keys, Ctrl+Z undoes). Help pictures are stills with alt text saying what changes; a help clip, if one is ever added, waits for a click when reduced motion is on (`src/components/HelpMedia.tsx`).)*

*(Phase 10, performance: only the Import section comes with the first load; the other sections load lazily in the background once the editor is up, and the About, Privacy and UI kit pages only when visited (first-load JavaScript about 162 KB gzipped). While a slider or the art is dragged the preview canvas is drawn at a pixel density of at most 1.25 and comes back sharp when the drag ends. A test drags sliders on a phone with the CPU slowed four times.)*

---

## 11. Help tips ("?")

- A `?` icon next to every **section heading** (and the top-bar items). *(Changed after Phase 1: controls inside a section — Brightness, Contrast, Thickness, the toolbar's zoom slider, Advanced… — no longer get their own `?`; it was too cluttered. Their help shows as a card when the control's name is hovered, or long-pressed on a touch screen, including any before/after picture the entry has (`src/components/LabelTip.tsx`), and every control still needs a help entry.)*
- Hover (desktop) or tap (touch) opens a small card: one or two plain sentences + a before/after picture or short looping clip (WebP/MP4, small file size).
- *(Phase 10: every help entry has a before/after picture, named after its id (`frame.thickness` → `public/help/frame-thickness.webp`), with alt text; the ones outside the Image and Effects sections are drawn by `scripts/help-token-pictures.ts` with the real renderer, and the help test fails if any is missing.)*
- *(Phase 3: the Image section's before/after pictures are drawn by `npm run help-images` with the real image code, into `public/help/`. A test checks every help picture exists, and that every Image control has one. Phase 6: the same script draws a before/after for every effect and Effects control with the real renderer; the picker's effect names open those cards.)*
- All help content lives in one file (e.g. `src/help/helpContent.ts`) keyed by control id, so it's easy to edit and spot missing entries. A test fails if a control has no help entry.

---

## 12. Assets and licences

- Built-in backgrounds, overlays, decorations and PNG frames must be **CC0 / public domain** or made for the project. If something under another free licence (e.g. CC BY) is used, it must be credited.
- Keep `ASSETS-CREDITS.md` listing every asset, its source and licence. Show credits on an "About" page.
- Fonts: open licences (SIL OFL) only.

---

## 13. Privacy

- Images are processed in the visitor's browser. The proxy only passes images through; it stores nothing.
- No analytics or cookies in version 1 (if added later: privacy-friendly, with a notice).
- Short "Privacy" and "About" pages.

*(Phase 10, as built: the Privacy page says pictures stay on the device; what the web-address proxy does (fetches, passes back, keeps nothing; a one-minute in-memory count per internet address against misuse); that previews load straight from the other site; what is kept in browser storage (the current token, presets, uploaded frames and fonts, small settings) and how to clear it; that Cloudflare hosts the site; and that any change (e.g. adverts) will be announced there first. The About page explains the three steps and shows `ASSETS-CREDITS.md`'s table, read at build time by `src/pages/credits.ts`.)*

---

## 14. Quality rules for the AI building this

- Read this file first. Follow it. If something here is unclear or seems wrong, ask the owner before changing direction, then update this file.
- Keep the renderer pure and tested; add pixel tests for each new layer type.
- Test on desktop and phone viewports (Playwright) for every phase.
- Keep components small; one stylesheet / design-token file for the look.
- Explain what you did in plain English at the end of each phase, with Windows (PowerShell) commands to run and see it.
- Update `README.md`, this file, and `docs/PROGRESS.md` (a checklist of phases) at the end of each phase.

---

## 15. Future features (not in version 1)

Mark **(paid?)** = candidates for a paid version of the tool.

| Feature | Notes |
|---|---|
| AI background removal **(paid?)** | Server-side for best quality, or in-browser model (~40–80 MB download). Plugs into the existing mask system. |
| AI auto pop-out **(paid?)** | Detect the subject and suggest a pop-out mask. |
| AI relighting **(paid?)** | "Relight"-style relighting of the imported image. |
| Animated borders and overlays **(paid?)** | Effects already take a time parameter; export GIF / APNG / WebM. |
| Pinterest board browsing | Requires a registered, approved Pinterest developer app and user login (OAuth). |
| Send to VTT | Owlbear Rodeo companion extension (or the owner's existing one), Foundry VTT module, per-VTT export presets (ideal sizes, names). |
| Condition-variant pack | Export a token plus its bloodied/petrified/etc. versions in one ZIP. |
| Accounts + cloud saving **(paid?)** | Presets and tokens across devices. Presets already carry ids and `schemaVersion` to make this easy. |
| Premium asset packs **(paid?)** | Extra frames, decorations, backgrounds. |
| Adverts | Slot already reserved below the editor (§8). |
