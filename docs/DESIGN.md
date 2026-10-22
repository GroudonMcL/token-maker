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

- The canvas token renderer: 5 shapes (Circle, Rounded, Square, Hexagon, Flat hex) and 27 code-drawn frames in three groups — **Classic** (Stamped, Gilded, Engraved, Arcane, Infernal, Double line, Polished, No frame), **Textures** (Oak, Cobblestone, Magma, Harlequin, Knotwork, Starfield) and **Classes** (one per D&D class plus Artificer). All are built like Stamped: a band lit from the top left, a pressed-in inner step, a drop shadow and a shadow cast onto the art. Every frame takes any colour, thickness, spacing, backing and opacity.
- "The export comes from the same renderer as the preview" — keep this rule.
- Crop geometry (drag, wheel/pinch zoom around the cursor, rotate, flip, fit/fill/reset, dimmed art outside the frame).
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
| ZIP | JSZip (or fflate) | Batch export. |
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
  schemaVersion: number;            // bump + write a migration whenever the shape changes
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

*(Phase 1: the real type is in `src/document/types.ts`, defaults in `src/document/defaults.ts`. Later-phase layers have placeholder types. `art` holds the asset id plus its transform (zoom, offset, rotation, flipX, flipY, lockFill); `frame` holds the selected preset id, style, colour, thickness, outer/inner spacing, opacity, backing colour and backing opacity; `shadows` holds outer, inner and pop-out settings. Saved documents go through `migrateDocument()` in `src/document/migrate.ts`, which runs version-by-version migrations and then checks every field, falling back to defaults.)*

Images themselves are **not** stored inside the document — the document holds asset ids (e.g. `asset:abc123`) that point to images held in memory/IndexedDB. This keeps presets small and shareable.

### 4.2 Units: "per grid square"

Sizes that should look the same on the map no matter how big the creature is are stored **per grid square**, not as a percentage of the whole token:

- frame thickness, outer spacing, inner spacing
- decoration size
- label text size and label shape size
- shadow distance and blur
- effect size (e.g. how far flames reach)

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

*(Phase 1: `renderToken(ctx, doc, assets, size)` in `src/render/render.ts` draws layers 1, 2, 5, 8 and 9; the other layers have marked empty slots. The extension drew the drop shadow and the shadow onto the art as part of each frame; here they are separate layers 1 and 8, so they can be switched off, follow the light, and include pop-out parts later. The outer shadow is drawn shadow-only and then cleared under the token, so it never shows through transparent parts.)*

Rules:

- Pop-out art must be pixel-identical to the inside art where they meet — no seams. That is why both come from one processed bitmap.
- The pop-out mask is stored in the **art image's own coordinates**, so moving, zooming, rotating or flipping the art moves the mask with it.
- Nothing is ever drawn outside the square output image. Pop-out parts may cover the border and the outer spacing, but never leave the square, so the token always lines up 1:1 with grid squares in a VTT.

---

## 6. Features

Every control has a **? help tip** (see §11).

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

The import file's name (without extension, tidied) becomes the token name; the user can edit it. *(Phase 1: separators become spaces, all-lowercase names get capital letters, and generic names such as "image.png" from a paste keep the current name. Dropped or pasted web links show a "coming in a later update" message until Phase 2.)*

**Batch mode** (optional switch): import several images at once (multi-select upload, multi-file drop, or several links). One shared style applies to all; each image keeps its own position/zoom/rotation and name. A thumbnail strip switches between them. Export all as a ZIP (§6.10).

### 6.2 Basic image editing

- **Always visible:** Brightness, Contrast, Saturation.
- **Advanced dropdown:**
  - Colour: Hue, Temperature, Tint
  - Light: Exposure, Highlights, Shadows
  - Detail: Sharpness, Blur
  - Style: Vibrance, Grayscale, Sepia, Invert
- **Background removal (flat colour):** the extension's method — pick the background colour automatically (from the edges) or with an eyedropper; **Intensity** slider (how similar a colour must be to be removed) and **Edge softness** slider.
- **Erase / restore brush** to fix mistakes: brush size, softness, and a simple mode where the user just drags one slider. Works with touch and pen. The removal result is stored as a mask (not by destroying pixels), so it can be changed later.
- **Transform:** drag to move, wheel/pinch to zoom around the pointer, **on-canvas handles** for scale and rotate (two-finger rotate on touch), flip horizontal/vertical, fit, fill, reset, and the existing "Keep the frame filled" option. *(Phase 1: four corner handles resize the art around its centre and a round handle above it rotates it (hold Shift to snap to 15°). Handles stay on screen even when the art's corners are off the canvas. "Keep the frame filled" is on by default for new tokens. A whole drag, pinch or burst of scrolling is one undo step.)*

### 6.3 Background

Options (one at a time):

- **Colour** — swatches + colour picker, opacity.
- **Gradient** — simple: two colours, linear or radial, angle. Advanced: full editor with any number of stops, positions and opacity.
- **Image** — from the built-in library (forest, dungeon stone, parchment, night sky, lava, water, tavern wood, snow, swamp…), the user's own image (same import methods as §6.1), or **the token's own art** (an enlarged copy).
- **Blur** slider for any background image (gives the "blurred copy of the art" look when used with the token's own art).

The background is affected by its own position/zoom, independent of the art.

### 6.4 Foreground overlays

Stackable list, drawn over the art and inside the frame:

- **Gradient** (same editor as §6.3)
- **Vignette** (colour, size, softness)
- **Foliage / smoke / mist / cobwebs** — from free-to-use (CC0) art packs where possible, otherwise drawn by code
- **Shadow** (darken one side/edge)
- **Lighting** — see §6.5

Each overlay: opacity, blend mode (normal, multiply, screen, overlay, soft light), position/scale where it makes sense.

### 6.5 Lighting

- **Directional light:** a direction dial, colour, strength; optional **rim light** (a thin bright edge on the subject, best with a removed background).
- **Presets** that set the directional light, then remain editable: Torchlight (warm, from below), Moonlight (cold, from above), Holy glow, Fel green, Firelight flicker look, Underdark (dim purple).
- Lighting is part of "processed art" (§5), so pop-out parts are lit identically.
- The light direction drives shadow direction (§6.7).

### 6.6 Pop-out (art over the border)

- The user paints a **pop-out mask** with a brush (add/erase, size, softness) over parts that should be drawn on top of the border — a head, horns, a sword.
- Pop-out parts get exactly the same adjustments, background removal, lighting and effects as the art inside (no seam).
- Moving/zooming/rotating the art keeps the mask aligned.
- Pop-out parts may extend over the border and outer spacing but are clipped to the square output.
- Show the mask as a coloured overlay while painting; a toggle hides it.

### 6.7 Shadows

- **Outer drop shadow** (outside the token).
- **Pop-out shadow** (cast by pop-out parts onto the border).
- **Inner shadow** (the frame's shadow onto the art): on/off, strength, softness.
- Outer and pop-out shadows **follow the light direction by default**; an "unlink" toggle reveals angle, distance, blur, colour and opacity.

### 6.8 Styles & effects

Stackable, reorderable list. Each effect chooses its placement: **behind art**, **over art** or **on border**. Each has an **Intensity** slider up front; the Advanced dropdown adds colour, size, spread and **Shuffle** (random variation, stored as a seed so it's repeatable).

- **Glows:** inner glow, outer glow (any colour — arcane blue, radiance gold, etc.).
- **Elemental:** fire, frost, poison, lightning, necrotic, radiant.
- **Condition looks** (one-click variants useful in VTTs): bloodied, petrified (stone), ethereal/invisible (faded), frightened, poisoned, charmed, unconscious.
- **Atmosphere:** mist, embers, sparkles, smoke.

All version-1 effects are static images (animation is a future feature, but design effects with a time parameter so animation can be added later).

### 6.9 Borders, decorations, presets and size

**Frames**

- **Code-drawn frames:** all 5 shapes and 27 frames from the extension, with colour, thickness, frame opacity, outer spacing, inner spacing, backing colour and backing opacity.
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

### 6.10 Label

- Shapes: **banner/ribbon**, **plaque**, **pill**, **box** (rounded or sharp corners), and **curved text on the ring** (no backing shape).
- **Free position:** drag anywhere; snaps to bottom/top by default.
- Shape colour, opacity, outline. Text: content (defaults to the token name), font, size, colour, outline, shadow, letter spacing, bold/italic, alignment.
- Fonts: a curated set of ~15 free fantasy-suitable fonts with open licences (e.g. Cinzel, Cinzel Decorative, IM Fell English, MedievalSharp, Pirata One, UnifrakturMaguntia, Uncial Antiqua, Almendra, Metamorphous, Grenze Gotisch, Macondo, Alegreya SC, Spectral, Germania One, Eagle Lake), **bundled with the site** (not loaded from Google at runtime) so exports never use a fallback font. Users can upload their own `.ttf/.otf/.woff/.woff2`, kept in IndexedDB.

### 6.11 Export

- **Formats:** PNG (transparent), WebP (transparent, smaller), JPG (no transparency — ask for a fill colour). GIF reserved for animated tokens later.
- **Resolution:** pixels per square — 128, 256 (default), 400, 512, or custom; show the final pixel size; cap the long side at 4096 px.
- **File name:** from the token name, editable; safe characters only.
- **Download** and **Copy to clipboard** (PNG; if the browser can't copy images, say so and offer download).
- **Batch:** a ZIP of every token in the batch, each with its own name.
- The export is produced by the same renderer as the preview.

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

---

## 8. Layout and responsiveness

Desktop and phone are **equally important**.

**Desktop (≥ 1024 px):** top bar (logo, Batch toggle, Undo/Redo, New) · large canvas in the centre with a floating toolbar (zoom slider, rotate, flip, fit, fill, lock, undo — as in the extension) · right-hand panel of collapsible sections · bottom bar with token thumbnail, name, size, final pixel size, **Export** button.

**Phone (< 768 px):** canvas fills the top part of the screen; a **bottom sheet** with icon tabs for each section (Import, Image, Background, Foreground, Lighting, Effects, Frame, Decor, Label, Export) that can be dragged up/down; big touch targets (≥ 44 px); pinch to zoom, two-finger rotate; brushes work with finger and pen.

**Tablet:** desktop layout with a narrower panel, or phone layout in portrait. *(Phase 0: from 768 px wide the desktop layout is used with a 290 px panel; below 768 px the phone layout is used.)*

**Phone tabs → sections** (Phase 0): the ten phone tabs hold the thirteen sections like this: Image = Image + Pop-out; Frame = Frame & shape + Size + Presets; every other tab holds the one section of the same name. On phones, the token summary and the Export button sit at the top of the bottom sheet instead of in a separate bottom bar.

**Panel sections** (in this order): Import · Image (adjust, background removal, brush) · Background · Foreground · Lighting & shadows · Pop-out · Effects · Frame & shape · Decorations · Size · Label · Presets · Export.

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

**Components** (in `src/components/`, demonstrated at `/kit`): collapsible `Section` with an `Advanced` sub-drop-down, `Slider` (shows its value, accepts typed numbers, one undo step per drag), `ColorSwatches` (swatches + picker + hex box), `SegmentedButtons`, `TileGrid` (grouped picture tiles, like the frame picker), `ImageStrip`, `Toggle`, `HelpTip`. Every one takes a required `helpId`.

**Motion:** 120 ms for hovers, 220 ms for opening and closing, all switched off for `prefers-reduced-motion`.

**Logo:** a placeholder gold ring with a star (`src/layout/BrandMark.tsx`, `public/favicon.svg`) until the final name and logo are decided.

---

## 10. Accessibility

- Every control reachable and usable by keyboard; visible focus.
- Sliders show values and accept typed numbers.
- Help tips readable by screen readers; don't rely on hover alone (tap/click to open on touch).
- Respect `prefers-reduced-motion` (help GIFs paused, show a still).

---

## 11. Help tips ("?")

- A `?` icon next to every section and non-obvious control.
- Hover (desktop) or tap (touch) opens a small card: one or two plain sentences + a before/after picture or short looping clip (WebP/MP4, small file size).
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
