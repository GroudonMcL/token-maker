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

- [ ] **Phase 5 — Pop-out art and shadows**
  - [ ] Pop-out mask brush (add/erase, size, softness), coloured overlay with show/hide, stored in art-image coordinates
  - [ ] Pop-out drawn from the same processed-art bitmap (no seam), clipped only to the square
  - [ ] Shadows (in the "Lighting & shadows" section): outer drop shadow, pop-out shadow, inner shadow; follow the light unless unlinked; per grid square
  - [ ] Outer shadow silhouette includes pop-out parts (and decorations later)
  - [ ] Tests: no seam, mask stays aligned after transform, nothing outside the square, shadow follows the light
  - **Done when:** a dragon's horns break over the border with a matching shadow and stay on the dragon when the art moves

- [ ] **Phase 6 — Styles and effects**
  - [ ] Reorderable effect list; placement (behind art / over art / on border); Intensity; Advanced: colour, size, spread, Shuffle seed
  - [ ] Glows, elemental, condition looks, atmosphere
  - [ ] Each effect a function of (settings, size, seed, time); sizes per grid square
  - [ ] Live thumbnails in a tile grid; help tips with before/after images
  - [ ] Tests: deterministic per seed, placement order, smooth with 3 effects on a phone viewport
  - **Done when:** stack a frost glow on the border, mist over the art and a "bloodied" look, reorder them, and export

- [ ] **Phase 7 — Image frames, decorations and presets**
  - [ ] PNG frames: built-in set + uploads, automatic hole detection with nudging, saved in IndexedDB
  - [ ] Decorations: library, snap points with mirroring or free drag, resize/rotate handles, tint, opacity, per grid square, touch-friendly
  - [ ] Presets: built-ins, save your own, `.tokenpreset.json` / text code export and import, never includes art, schemaVersion migration
  - [ ] Tests: hole detection, snapping/mirroring maths, preset round trip, old-preset migration
  - **Done when:** upload a ring PNG, add mirrored horns, save a preset, export it and load it in another browser

- [ ] **Phase 8 — Label**
  - [ ] Shapes: banner/ribbon, plaque, pill, box, curved ring text; free drag with top/bottom snapping
  - [ ] Shape colour/opacity/outline; text font, size, colour, outline, shadow, spacing, bold/italic, alignment; per grid square
  - [ ] Bundled fantasy fonts (DESIGN.md §6.10), export waits for fonts, font picker previews each font
  - [ ] Upload your own font (saved in IndexedDB)
  - [ ] Shrink-to-fit for long names
  - [ ] Tests: export uses the chosen font, curved text, shrink-to-fit
  - **Done when:** a ribbon label in a fantasy font, or the name curved round the ring, and the export matches

- [ ] **Phase 9 — Export and batch mode**
  - [ ] Export panel: PNG / WebP / JPG (fill colour), pixels per square (128, 256, 400, 512, custom) with final size and 4096 px cap, safe file name, Download, Copy to clipboard with fallback
  - [ ] Batch mode: multi-image import, shared style, per-image transform/masks/name, thumbnail strip, "Export all" ZIP
  - [ ] Big exports and ZIPs work on phones (Web Worker, progress bar)
  - [ ] A clear place in the code for future GIF export
  - [ ] Tests: formats and resolutions match the preview, file naming, ZIP contents, Playwright batch flow on desktop and phone
  - **Done when:** six goblin images share one style, each with its own crop, downloaded as a ZIP of six named tokens

- [ ] **Phase 10 — Polish, help content and launch**
  - [ ] Every help tip has clear text and a small before/after image or clip (reduced motion respected)
  - [ ] Phone pass (nothing cramped or slow, 44 px targets)
  - [ ] Accessibility pass (keyboard, focus, screen-reader labels, contrast in both themes)
  - [ ] Performance: fast first load (lazy-loading), smooth sliders on a mid-range phone
  - [ ] First-time experience with a sample image to try
  - [ ] Final About page (credits from ASSETS-CREDITS.md) and Privacy page
  - [ ] Ad slot present but off
  - [ ] Final README with a "Future features" section from DESIGN.md §15
  - [ ] All tests pass; a short checklist for the owner to try before sharing
  - **Done when:** all tests pass and the site is live on Cloudflare Pages

## Later (not phases yet)

From DESIGN.md §15. Don't build these until the owner decides to: AI background removal, AI auto pop-out, AI relighting, animated borders/overlays with GIF export, Pinterest board browsing, sending tokens to Owlbear/Foundry, condition-variant packs, accounts and cloud saving, premium asset packs, switching adverts on.
