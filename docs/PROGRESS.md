# Progress

A checklist of build phases, following [`BUILD-PROMPTS.md`](BUILD-PROMPTS.md). Do one phase at a time, in order. Tick a phase when its "Done when" check passes.

- [x] **Phase 0 — Project setup, visual design and layout shell**
  - [x] Vite + React + TypeScript, Vitest, Playwright; npm scripts `dev`, `build`, `test`, `e2e`, `typecheck`, `lint`
  - [x] Cloudflare Pages set-up with a `/functions` folder (placeholder `/api/health`); dashboard deploy steps in README
  - [x] Visual identity chosen ("Lamplit Workbench" + navy sky) and recorded in DESIGN.md §9 and `src/styles/tokens.css`
  - [x] Layout shell for desktop, tablet and phone (top bar, canvas + floating toolbar, side panel sections, bottom sheet with tabs, bottom bar with Export)
  - [x] Shared components: Section + Advanced, Slider, colour swatches + picker, segmented buttons, tile grid, image strip, toggle, HelpTip
  - [x] Help text in `src/help/helpContent.ts` with a test for missing entries
  - [x] Ad slot below the editor behind the `ads` flag (off)
  - [x] Placeholder About and Privacy pages
  - **Done when:** `npm run dev` shows the shell at desktop and phone widths, tests pass, README explains running and deploying ✔

- [x] **Phase 1 — Token document, renderer and basic import**
  - [x] Studied the extension's `extension/` code; ported the renderer, 5 shapes and 27 frames to `src/render/` (no LegendKeeper/Owlbear code)
  - [x] TokenDocument with `schemaVersion` + migration helper; store with undo/redo and IndexedDB autosave (built on `src/state/history.ts`)
  - [x] Pure `renderToken(ctx, doc, assets, size)` / `render(doc, assets, size)` in DESIGN.md §5 order: outer drop shadow, backing, art, inner shadow, frame; empty slots for the other layers
  - [x] Per-grid-square sizes; Size section (Tiny … Gargantuan, Custom)
  - [x] Import: file picker, drag and drop anywhere, paste; file name becomes the editable token name
  - [x] Canvas: drag, wheel/pinch zoom around the pointer, scale/rotate handles, two-finger rotate, flip both ways, fit, fill, reset, "Keep the frame filled", dimmed art outside the frame (mouse, touch, pen)
  - [x] Frame & shape section: shapes, 27 frame tiles with live thumbnails, colour, thickness, frame opacity, outer/inner spacing, backing colour and opacity
  - [x] Temporary PNG export at 256 px per square from the same renderer
  - [x] Tests: migrations, undo/redo, per-square maths, pixel tests for every frame and shape, `npm run frame-sheet`, Playwright import → download (and size, frames, handles, drop/paste, autosave) on desktop, tablet and phone
  - **Done when:** drop an image in, frame it with any of the 27 frames, move it with handles, change to Large with the border staying the same thickness, download a PNG ✔
  - [x] Feedback round after Phase 1:
    - [x] Flip icons swapped; "Keep the frame filled" button removed (art is free by default); no "?" next to the zoom slider
    - [x] "?" buttons only on section headings (control help shows as a hover tooltip); "Image" label removed from Import
    - [x] One panel section open at a time (side panel and phone tabs)
    - [x] Mouse wheel over the token/art zooms the view (up to 800%, Space/middle-drag to look around, "Reset view" button); elsewhere it scrolls the side panel
    - [x] Frame highlights colour for frames with fixed-colour details (Monk, Warlock, Paladin, Rogue, Ranger, Bard, Starfield)
    - [x] Default-value notch on every slider
    - [x] Frame opacity removed (frames are always solid)

- [x] **Phase 2 — Import from the web (web addresses and Pinterest links)**
  - [x] `/api/fetch-image` and `/api/page-images` Pages Functions with the extension's SSRF rules + per-IP rate limiting
  - [x] Web-address box: direct image links load; page links show an image strip (tiny icons hidden)
  - [x] Pinterest pin and `pin.it` links (follow redirects, prefer `/originals/`)
  - [x] Pasted URLs and images dragged from other tabs use the same path
  - [x] Friendly messages when a site blocks fetching
  - [x] README: testing the functions locally on Windows (`wrangler pages dev`)
  - [x] Tests: SSRF rules, HTML image extraction (srcset, og:image), Pinterest parsing from saved sample HTML, the endpoints with a pretend internet, the editor's import flow, and Playwright web imports on desktop, tablet and phone
  - **Done when:** an image link, a normal page link and a Pinterest pin link each get an image into the editor ✔

- [x] **Phase 3 — Image editing, background removal and brushes**
  - [x] Brightness, Contrast, Saturation; Advanced: Hue, Temperature, Tint, Exposure, Highlights, Shadows, Sharpness, Blur, Vibrance, Grayscale, Sepia, Invert
  - [x] Cached "processed art" bitmap (transform → adjustments → removal mask → lighting hook), smooth on phones
  - [x] Flat-colour background removal (auto from edges or eyedropper), Intensity and Edge softness, stored as a mask
  - [x] Erase/restore brush (size, softness, simple mode, pressure), undoable
  - [x] While the brush is active, the frame is drawn at 50% opacity so the art under it shows (preview only; added with the Phase 1 feedback)
  - [x] Help tips with before/after images
  - [x] Tests: adjustment and mask pixel tests, renderer tests with removal and strokes, migration v1 → v2; Playwright removal, brushing (mouse and real touch), eyedropper and export-matches-preview on desktop, tablet and phone
  - **Done when:** remove a flat background, tidy it with the brush, tune the image, and the export matches the preview ✔

- [x] **Phase 4 — Background, foreground overlays and lighting**
  - [x] Background: colour, gradient (simple + Advanced multi-stop editor), picture (built-in library, your own by upload or link, the token's own art), blur, its own move (canvas tool) and zoom, opacity
  - [x] Built-in background library: 10 pictures drawn by code (`npm run make-backgrounds`), listed in ASSETS-CREDITS.md
  - [x] Foreground: stack of overlays (gradient, vignette, foliage, smoke, mist, cobwebs, edge shadow), reorder / hide / remove, opacity and blend mode (normal, multiply, screen, overlay, soft light), colour, side, reach, softness, scale, shuffle; drawn by code
  - [x] Lighting: direction dial, colour, strength, falloff, rim light, presets (Torchlight, Moonlight, Holy glow, Fel green, Firelight, Underdark) that stay editable; the last step of the processed art (works with rotated and flipped art); optionally lights the background too
  - [x] Help for every control
  - [x] Tests: pixel tests for every background type, gradient stops, picture move/zoom/blur, every overlay, every blend mode, overlay order, lighting direction/colour/falloff/rim and the background lighting; document v2 → v3; Playwright blurred forest + vignette + torchlight with export-matches-preview on desktop, tablet and phone, overlay list and presets, own background picture moved on the canvas
  - **Done when:** a character on a blurred forest background with a vignette and torchlight from below, export matching the preview ✔

- [x] **Phase 5 — Pop-out art and shadows**
  - [x] Pop-out mask brush (add/erase, size, softness, pen pressure), teal overlay with show/hide, Pop-out on/off, Clear; stored in art-image coordinates (document v3 → v4)
  - [x] Pop-out drawn from the same processed-art bitmap (no seam), clipped only to the square (the whole render is now clipped to the square)
  - [x] Shadows (in the "Lighting & shadows" section): outer drop shadow, pop-out shadow (onto the frame band), inner shadow; follow the light unless unlinked; per grid square
  - [x] Outer shadow silhouette includes pop-out parts (decorations join it in Phase 7)
  - [x] Help for every control
  - [x] Tests: pixel-identical seam test, mask stays aligned after move/rotate/flip, nothing outside the square, pop-out and drop shadows follow the light (and unlinked angle), drop shadow includes pop-out parts, pop-out off, migration v3 → v4; Playwright pop-out paint → move → undo → off with export matching the preview, and unlinking the shadow, on desktop, tablet and phone
  - **Done when:** a dragon's horns break over the border with a matching shadow and stay on the dragon when the art moves ✔

- [x] **Phase 6 — Styles and effects**
  - [x] Reorderable effect list (up to 12, top drawn last, hide/remove, one undo step each); placement (behind art / over art / on border); Intensity; Advanced: colour, size (per square), spread, Shuffle seed; document v4 → v5
  - [x] Glows (inner, outer — behind the art it hugs a cut-out creature), elemental (fire, frost, poison, lightning, necrotic, radiant), condition looks (bloodied, petrified, ethereal, frightened, poisoned, charmed, unconscious), atmosphere (mist, embers, sparkles, smoke), all drawn by code
  - [x] Each effect a function of (settings, size, seed, time) in `src/render/effectPainters.ts`; time is 0 for now but already moves flames, embers, sparkles and lightning; sizes per grid square
  - [x] Each effect is drawn once into cached layers and composited, so Intensity drags never redraw it
  - [x] Live thumbnails in a tile grid on the token's own shape and frame; help tips with before/after pictures for every effect and control (`npm run help-images`); `npm run effect-sheet` for checking by eye
  - [x] Tests: every effect in every placement draws the same pixels twice for a seed, Shuffle changes the layout, time changes the moving ones, nothing outside the square, Intensity/hide, placement layers and list order, condition looks, per-square size on Medium vs Large, layer reuse, a 3-effect phone-size render; migration v4 → v5 and effect checks; the panel (add, reorder, hide, remove, undo, help ids); Playwright frost + mist + bloodied → reorder → export (matches the preview, survives a reload), placement and intensity, and smooth slider moves with 3 effects on desktop, tablet and phone
  - **Done when:** stack a frost glow on the border, mist over the art and a "bloodied" look, reorder them, and export ✔

- [x] **Phase 7 — Image frames, decorations and presets**
  - [x] PNG frames: 8 built-in (drawn by code, `npm run make-frames`) + uploads, automatic hole detection (`src/image/frameHole.ts`) with hole size / sideways / up-down nudging, uploads saved in IndexedDB; document v5 → v6
  - [x] Decorations: 18 code-drawn decorations in 4 groups, 8 snap points (facing outwards) with mirroring or free drag, on-canvas drag with snapping, resize/rotate handles, tint, opacity, flip, per grid square, touch-friendly; part of the drop shadow's silhouette
  - [x] Presets: 8 built-ins, save your own (IndexedDB), `.tokenpreset.json` file and `TKP1.` text code export/import (uploaded frames travel with them), never includes art, preset `schemaVersion` + `docVersion` migration
  - [x] Owner requests: **Rim softness** slider (old saved rims stay crisp); preset text codes for choosing the final built-ins
  - [x] Tests: hole detection (sample frames and every built-in), snapping/mirroring maths, decoration and picture-frame pixel tests, preset round trip (file and code), old-preset and v5 document migration, the three new panels; Playwright ring upload → mirrored horns → save → export → load in another browser (file and code), decoration drag and built-in frame, on desktop, tablet and phone
  - **Done when:** upload a ring PNG, add mirrored horns, save a preset, export it and load it in another browser ✔

- [x] **Phase 8 — Label**
  - [x] Shapes: banner/ribbon (with a bend), plaque, pill, box (rounded or sharp), curved ring text following any token shape or a picture frame's hole; drag on the canvas with top/bottom snapping (Alt = free), or Top/Bottom/Free in the panel; document v6 → v7
  - [x] Shape colour/opacity/outline; text (defaults to the token name), font, size, colour, outline, shadow, letter spacing, bold/italic, alignment; per grid square
  - [x] 15 bundled OFL fantasy fonts from @fontsource (credited in ASSETS-CREDITS.md), loaded with the FontFace API; the export waits for the font; the picker shows each name in its own font
  - [x] Upload your own font (.ttf/.otf/.woff/.woff2, saved in IndexedDB; travels with shared presets)
  - [x] Shrink-to-fit for long names (off: the shape grows instead)
  - [x] `npm run label-sheet` for checking by eye
  - [x] Tests: export uses the chosen font (pixel test against other fonts and a fallback), curved text follows every token shape and a picture frame, bent banners, shrink-to-fit (no text pixels off the shape), per-square size, snapping and dragging, migration v6 → v7, presets keep style not words and carry uploaded fonts, the panel; Playwright banner in Pirata One → another font → ring text → long name → reload, drag to snap, and font upload, on desktop, tablet and phone
  - **Done when:** a ribbon label in a fantasy font, or the name curved round the ring, and the export matches ✔

- [x] **Phase 9 — Export and batch mode**
  - [x] Export panel: PNG / WebP / JPG (fill colour), pixels per square (128, 256, 400, 512, custom) with final size and 4096 px cap, safe editable file name, Download, Copy to clipboard with fallback message; Advanced quality for WebP/JPG; choices remembered (not part of the look)
  - [x] Batch mode: Batch switch, multi-file upload/drop, several links, shared style, per-image transform/masks/name/label words, thumbnail strip (add, switch, remove), undo kept across switches, autosaved, "Export all" ZIP of named tokens
  - [x] Big exports and ZIPs work on phones (art and ZIP in Web Workers, one token at a time, canvases released, progress bar with Stop)
  - [x] A clear place in the code for future GIF export (`src/export/animated.ts`)
  - [x] Tests: every resolution matches the renderer pixel for pixel, JPG fill and see-through PNG/WebP, format fallback, file naming and clashes, ZIP contents, batch style sharing / per-picture crop / undo across switches / labels / remove, batch autosave, the Export panel; Playwright six goblins → style → nudge crops → rename → ZIP of six named tokens (survives a reload), every format and resolution vs the preview, custom size, file name, and copy to clipboard, on desktop, tablet and phone
  - **Done when:** six goblin images share one style, each with its own crop, downloaded as a ZIP of six named tokens ✔

- [ ] **Phase 10 — Polish, help content and launch** (everything built and tested; ticks when the site is live)
  - [x] Every help tip has clear text and a before/after picture (all 209, drawn by the real renderer with `npm run help-images`, alt text on each); a clip would wait for a click with reduced motion on
  - [x] Phone pass: every control at least 44 px to touch, checked in every tab; the token moves above a half-open sheet
  - [x] Accessibility pass: axe finds nothing in both themes on desktop, tablet and phone (editor with every section open, About, Privacy, UI kit); focus ring at every Tab stop; styling by keyboard alone; contrast test in both themes
  - [x] Performance: sections and pages lazy-loaded (first-load JS 179 → 162 KB gzipped); frames cached in the renderer; lower-density preview while dragging; smooth-slider test on a 4× slowed phone
  - [x] First-time experience: welcome card on the empty token with Upload image, **Try a sample** and three steps
  - [x] Final About page (credits read from ASSETS-CREDITS.md) and Privacy page
  - [x] Ad slot present but off (`VITE_FEATURE_ADS`, checked by the shell test)
  - [x] Final README with what the site does, a checklist for the owner and a "Future features" section from DESIGN.md §15
  - [x] All tests pass (unit, end-to-end on desktop, tablet and phone, typecheck, lint, build)
  - [ ] **Owner:** merge to `main`, check the Cloudflare Pages deployment, and go through README §6 on the live site
  - **Done when:** all tests pass and the site is live on Cloudflare Pages

## Owner feedback after Phase 10 (document v8)

- [x] Main view: resizable side panel; dark theme by default with a moon/sun toggle (no "system"); no "?" beside the theme; Simple / Advanced / Expert menu style above Import; sections reordered (Import, Image, Background, Frame & shape, Pop-out, Lighting & shadows, Effects, Decorations, Size, Label, Presets, Export)
- [x] Foreground merged into Effects (v7 → v8 migration); Blur and Blend mode on every effect; picture effects (12 CC0 Kenney sprites, or your own picture)
- [x] Web imports: a clear message when `/api` isn't running; `npm run preview` serves `/api`; Workers deploys get the image server (`wrangler.jsonc`, `worker/index.ts`)
- [x] A reset button beside every slider
- [x] Background removal moved to Background; "Remove enclosed gaps too"; in-browser AI cut-out (BiRefNet-lite 512, Transformers.js, Web Worker); gradient preview bar removed
- [x] Picture decorations (14 CC0 Kenney icons, or your own picture)
- [x] Size buttons wrap instead of running off the panel; Small covers 0.8 of a square, Tiny 0.5
- [x] Label: Plain text shape; free labels get an anchor point and rotation
- [x] JPG export removed

## Frame Studio designs as frames (document v9)

- [x] Frame Studio's project reader and renderer copied into `src/frameStudio/` by Frame Studio's `npm run share:export`, with `SOURCE.json` and a test that fails if a copy is edited here
- [x] Frame type **Frame Studio**: open a `.framestudio.json` file; designs kept in this browser (`token-maker-designs`) and shown as tiles; remove one; the band follows Thickness, Outer spacing and Inner spacing and the token's shape
- [x] The design is kept in the token (v8 → v9 migration; checked by Frame Studio's own reader), so undo, autosave, batch mode and presets carry it; shared presets add it to the other browser's designs
- [x] Help tips with before/after pictures for the new controls (`npm run help-images`)
- [x] Tests: a design looks exactly the same here as in Frame Studio on every shape, thickness, spacing and token size; the migration and checks; the panel, the library and presets; Playwright on desktop, tablet and phone
- **Done when:** a design made in Frame Studio opens as a frame here from its `.framestudio.json` file ✔
- [x] Copy brought up to Frame Studio 0.10.0 (Phases 6–10 and the themed borders; it reads Frame Studio files up to format 9, so effects, generators, text and the 21 themed borders draw here as they do there); a test draws every themed border in both and they match pixel for pixel
- [x] Copy brought up to Frame Studio's format 10 (the last four conversions, more ornaments and textures, game-icons ornaments, photo textures, paint fills): a design's photo textures load with the token's other pictures, before exports too, and the frame redraws when one arrives; a test draws a design with photos, icons and paint fills in both apps and they match pixel for pixel, and a Playwright test opens one on desktop, tablet and phone

## Later (not phases yet)

From DESIGN.md §15. Don't build these until the owner decides to: AI auto pop-out, AI relighting, animated borders/overlays with GIF export, Pinterest board browsing, sending tokens to Owlbear/Foundry, condition-variant packs, accounts and cloud saving, premium asset packs, switching adverts on.
