# Token Maker — Build Prompts

## How to use these

1. Create a new, empty GitHub repository for the site (e.g. `token-maker`).
2. Open it in your AI coding tool (e.g. Claude Code).
3. Create a folder called `docs` and put `DESIGN.md` inside it (`docs/DESIGN.md`).
4. Paste **Phase 0**. Let it finish, try the result in your browser, and fix anything that's off before moving on.
5. Paste the next phase. Always one phase at a time, in order.
6. After each phase, commit (save) the work to GitHub. Ask the AI "commit and push this phase" if you're unsure how.

Tips:

- If the AI asks you a question, answer it — every phase tells it to ask rather than guess on big decisions.
- If something breaks, describe what you see (or paste a screenshot) rather than trying to fix code yourself.
- If you change your mind about a feature, tell the AI to update `docs/DESIGN.md` first, then build.

Each prompt starts with the same short "ground rules" block so it works even in a fresh chat.

---

## Phase 0 — Project setup, visual design and layout shell

```
Ground rules: Read docs/DESIGN.md fully before doing anything. It is the source of truth. I'm new to coding and use Windows, so explain what you did in plain English and give PowerShell commands. If a big decision isn't covered by the design doc, ask me before guessing. At the end, update README.md, docs/DESIGN.md (if anything changed) and docs/PROGRESS.md (a checklist of all phases, ticking this one).

Phase 0 goal: set up the project and build an empty but good-looking, responsive app shell.

1. Create a Vite + React + TypeScript project with Vitest and Playwright set up. Add npm scripts: dev, build, test, e2e, typecheck, lint.
2. Set it up to deploy to Cloudflare Pages from GitHub, with a /functions folder for later. Write step-by-step instructions in README.md for connecting the repo to Cloudflare Pages through the Cloudflare dashboard (no command-line deploy needed).
3. Design a FRESH visual identity (see DESIGN.md §9). Propose 2–3 short directions to me first (colours, fonts, mood — describe them, and if you can, show a quick mock), wait for my choice, then record the final design tokens (colours for light and dark themes, fonts, spacing, radii, shadows) in DESIGN.md §9 and in one CSS/design-token file.
4. Build the layout shell from DESIGN.md §8 for desktop, tablet and phone: top bar, central canvas area with a floating toolbar, right-hand collapsible panel sections on desktop, a draggable bottom sheet with icon tabs on phone, and the bottom bar with an Export button. Sections can be empty placeholders for now, in the order listed in §8.
5. Build the shared UI components the later phases will use: collapsible Section (with an "Advanced" sub-dropdown), Slider (shows value, accepts typed numbers, one undo step per drag), colour swatches + picker, segmented buttons, tile grid (like the frame picker), image strip, toggle, and the HelpTip "?" component from DESIGN.md §11 (hover on desktop, tap on touch, text + image/clip, keyboard and screen-reader friendly). Put help text in src/help/helpContent.ts and add a test that fails if a control is missing its help entry.
6. Add a hidden ad slot below the editor behind a feature flag that is OFF (DESIGN.md §8).
7. Add placeholder About and Privacy pages.

Done when: `npm run dev` shows the shell looking right at desktop and phone widths, tests pass, and README explains how to run it and deploy it.
```

---

## Phase 1 — Token document, renderer and basic import

```
Ground rules: Read docs/DESIGN.md fully before doing anything. It is the source of truth. I'm new to coding and use Windows, so explain what you did in plain English and give PowerShell commands. If a big decision isn't covered by the design doc, ask me before guessing. At the end, update README.md, docs/DESIGN.md (if anything changed) and docs/PROGRESS.md.

Phase 1 goal: a working token maker with the existing extension's frames, importing from the computer, on-canvas editing, undo/redo and a basic PNG download.

1. Clone or read https://github.com/GroudonMcL/LK-to-Owlbear-Combined and study the token editor and canvas renderer in extension/ (shapes, 27 frames, crop geometry, frame sheet script, renderer tests). Port the renderer and frames into this project as a standalone module with no LegendKeeper or Owlbear code.
2. Implement the TokenDocument (DESIGN.md §4.1) with schemaVersion and a migration helper, and the store with undo/redo (§4.3) and autosave to IndexedDB (§4.4).
3. Make the renderer a pure function render(doc, assets, outputSize) following the layer order in DESIGN.md §5. For now implement: backing, art, inner shadow, frame, outer drop shadow. Leave clear, empty hooks for the other layers.
4. Store frame thickness, spacing and shadow sizes per grid square (DESIGN.md §4.2) so changing creature size keeps the border the same thickness on the map. Add the Size section (Tiny, Small, Medium, Large, Huge, Gargantuan, Custom).
5. Import: upload (file picker), drag and drop anywhere on the page, and paste from clipboard (DESIGN.md §6.1 items 1–3). The file name becomes the token name (editable).
6. Canvas interaction: drag to move, wheel and pinch zoom around the pointer, on-canvas handles for scale and rotate, two-finger rotate on touch, flip horizontal and vertical, fit, fill, reset, "Keep the frame filled", dimmed art outside the frame. Must work equally with mouse, touch and pen.
7. Frame & shape section: 5 shapes, all 27 frames as thumbnail tiles, colour, thickness, frame opacity, outer/inner spacing, backing colour and opacity — as in the extension.
8. A temporary Export button that downloads a PNG at 256 px per square using the same renderer.
9. Tests: document migrations, undo/redo, per-square sizing maths, pixel tests for each frame (a frame-sheet script like the extension's), and a Playwright test that imports an image and downloads a PNG on desktop and phone viewports.

Done when: I can drop an image in, frame it with any of the 27 frames, move it with handles, change size to Large and see the border stay the same thickness, and download a PNG.
```

---

## Phase 2 — Import from the web (web addresses and Pinterest links)

```
Ground rules: Read docs/DESIGN.md fully before doing anything. It is the source of truth. I'm new to coding and use Windows, so explain what you did in plain English and give PowerShell commands. If a big decision isn't covered by the design doc, ask me before guessing. At the end, update README.md, docs/DESIGN.md (if anything changed) and docs/PROGRESS.md.

Phase 2 goal: import images from a web address or Pinterest pin link (DESIGN.md §6.1 items 4–5, and §7).

1. Build the two Cloudflare Pages Functions in DESIGN.md §7: /api/fetch-image and /api/page-images. Port the SSRF protection rules from the extension's server/ code (https only on every hop, block private IPs and local names, size caps, timeouts, content sniffing) and add simple per-IP rate limiting.
2. A web-address box in the Import section. Direct image links load straight away. Normal page links show an image strip of the images found on the page (ignore tiny icons); the user picks one.
3. Pinterest: accept pin links including pin.it short links; follow redirects, read the pin's main image (prefer the /originals/ size) and load it.
4. Route pasted URLs and images dragged from other browser tabs through this same path.
5. Friendly error messages when a site blocks fetching (suggest "Copy image address" or downloading and uploading).
6. Explain in README how to test the functions locally on Windows (e.g. with wrangler pages dev).
7. Tests: unit tests for the SSRF rules, HTML image extraction (including srcset and og:image) and Pinterest parsing using saved sample HTML (no live network in tests).

Done when: pasting an image link, a normal web page link or a Pinterest pin link each gets an image into the editor.
```

---

## Phase 3 — Image editing, background removal and brushes

```
Ground rules: Read docs/DESIGN.md fully before doing anything. It is the source of truth. I'm new to coding and use Windows, so explain what you did in plain English and give PowerShell commands. If a big decision isn't covered by the design doc, ask me before guessing. At the end, update README.md, docs/DESIGN.md (if anything changed) and docs/PROGRESS.md.

Phase 3 goal: the Image section from DESIGN.md §6.2.

1. Always-visible sliders: Brightness, Contrast, Saturation. An Advanced dropdown with Hue, Temperature, Tint, Exposure, Highlights, Shadows, Sharpness, Blur, Vibrance, Grayscale, Sepia, Invert.
2. Build the "processed art" step from DESIGN.md §5 (transform → adjustments → removal mask → lighting hook) as one cached bitmap that only recomputes when its inputs change. Keep slider dragging smooth on a phone (use a Web Worker/OffscreenCanvas or a lower-resolution preview while dragging if needed).
3. Flat-colour background removal (port the extension's method): auto-detect from edges or pick with an eyedropper, Intensity and Edge softness sliders. Store the result as a mask, never destroying the original pixels.
4. Erase/restore brush on that mask: size, softness, plus a simple single-slider mode. Works with mouse, finger and pen (use pointer pressure if available). Brush strokes are undoable.
5. Help tips with before/after images for every control.
6. Tests: pixel tests for each adjustment and for mask removal/restore; Playwright test of brushing on desktop and phone viewports.

Done when: I can remove a flat background, tidy it with the brush, and tune the image, and the export matches the preview.
```

---

## Phase 4 — Background, foreground overlays and lighting

```
Ground rules: Read docs/DESIGN.md fully before doing anything. It is the source of truth. I'm new to coding and use Windows, so explain what you did in plain English and give PowerShell commands. If a big decision isn't covered by the design doc, ask me before guessing. At the end, update README.md, docs/DESIGN.md (if anything changed) and docs/PROGRESS.md.

Phase 4 goal: DESIGN.md §6.3, §6.4 and §6.5.

1. Background section: colour, gradient (simple two-colour linear/radial with angle; Advanced: full multi-stop editor with positions and opacity), image (built-in library, own image via any import method, or the token's own art), blur slider, and its own move/zoom.
2. Build a small built-in background library (8–12 images). Use CC0/public-domain sources or generate them with code; record every source and licence in ASSETS-CREDITS.md. Ask me before using anything that needs attribution.
3. Foreground section: a stackable, reorderable list of overlays — gradient, vignette, foliage, smoke, mist, cobwebs, edge shadow — each with opacity and blend mode. Foliage/smoke/mist from CC0 packs where possible, otherwise drawn by code.
4. Lighting: directional light (direction dial, colour, strength), optional rim light, and presets (Torchlight, Moonlight, Holy glow, Fel green, Firelight, Underdark) that set the light and stay editable. Lighting belongs to the processed-art step so later pop-out parts match exactly.
5. Help tips for everything.
6. Tests: pixel tests for each background type, overlay and blend mode, and for lighting direction.

Done when: I can put a character on a blurred forest background with a vignette and torchlight from below, and the export matches the preview.
```

---

## Phase 5 — Pop-out art and shadows

```
Ground rules: Read docs/DESIGN.md fully before doing anything. It is the source of truth. I'm new to coding and use Windows, so explain what you did in plain English and give PowerShell commands. If a big decision isn't covered by the design doc, ask me before guessing. At the end, update README.md, docs/DESIGN.md (if anything changed) and docs/PROGRESS.md.

Phase 5 goal: DESIGN.md §6.6 and §6.7.

1. Pop-out section: paint a pop-out mask with a brush (add/erase, size, softness), shown as a coloured overlay while painting, with a show/hide toggle. Store the mask in the art image's own coordinates so moving, zooming, rotating and flipping keep it aligned.
2. Render pop-out art using the SAME processed-art bitmap as the inside art (layer 13 in DESIGN.md §5) so there is no seam. Clip it only to the square output image — it can cover the border and outer spacing but never leave the square.
3. Shadows section: outer drop shadow, pop-out shadow onto the border, inner shadow (on/off, strength, softness). Outer and pop-out shadows follow the light direction from Phase 4 by default; an Unlink toggle shows angle, distance, blur, colour and opacity. Shadow sizes are per grid square.
4. Make sure the outer drop shadow includes pop-out parts and (later) decorations in the silhouette.
5. Tests: pixel test proving no seam between inside and pop-out art; mask stays aligned after transform; nothing drawn outside the square; shadow follows the light.

Done when: I can make a dragon's horns break over the border with a matching shadow, move the art, and the horns stay put on the dragon.
```

---

## Phase 6 — Styles and effects

```
Ground rules: Read docs/DESIGN.md fully before doing anything. It is the source of truth. I'm new to coding and use Windows, so explain what you did in plain English and give PowerShell commands. If a big decision isn't covered by the design doc, ask me before guessing. At the end, update README.md, docs/DESIGN.md (if anything changed) and docs/PROGRESS.md.

Phase 6 goal: DESIGN.md §6.8.

1. Effects section: a stackable, reorderable list. Each effect picks a placement — behind art, over art or on border — and has an Intensity slider; the Advanced dropdown adds colour, size, spread and Shuffle (a stored random seed).
2. Effects: inner glow, outer glow; fire, frost, poison, lightning, necrotic, radiant; condition looks (bloodied, petrified, ethereal/invisible, frightened, poisoned, charmed, unconscious); atmosphere (mist, embers, sparkles, smoke).
3. Write each effect as a function of (settings, size, seed, time) even though time is fixed for now, so animation can be added later without rewriting.
4. Effect sizes are per grid square.
5. Show live thumbnails of each effect in a tile grid, like the frame picker.
6. Help tips with before/after images.
7. Tests: each effect renders deterministically for a given seed; placement order is respected; performance stays smooth on a phone viewport with 3 stacked effects.

Done when: I can stack a frost glow on the border, mist over the art and a "bloodied" look, reorder them, and export.
```

---

## Phase 7 — Image frames, decorations and presets

```
Ground rules: Read docs/DESIGN.md fully before doing anything. It is the source of truth. I'm new to coding and use Windows, so explain what you did in plain English and give PowerShell commands. If a big decision isn't covered by the design doc, ask me before guessing. At the end, update README.md, docs/DESIGN.md (if anything changed) and docs/PROGRESS.md.

Phase 7 goal: the rest of DESIGN.md §6.9.

1. Image (PNG) frames: a small built-in set (CC0 or made by code, credited in ASSETS-CREDITS.md) and user uploads. On upload, find the hole automatically (transparent area connected to the centre) and use it as the art clipping shape, with a way to nudge it. Save uploaded frames in IndexedDB. Explain in the help tip that image frames scale with the token.
2. Decorations section: a library (gems, skulls, horns, wings, ribbons, laurels, class icons, stars, chains — CC0 or code-drawn, credited). Snap points (top, bottom, sides, diagonals) with optional mirroring, or free drag; on-canvas resize/rotate handles; tint and opacity; sizes per grid square. Works with touch.
3. Presets section: built-in presets (Boss, Undead, Party member, Minion, Fey, Fiend, Celestial, Construct); save your own to IndexedDB; export/import a preset as a .tokenpreset.json file or copyable text code. Presets never include the user's art. Migrate old preset files using schemaVersion.
4. Tests: hole detection on sample frames; decoration snapping and mirroring maths; preset save → export → import round trip; old-version preset migration.

Done when: I can upload my own ring PNG, add mirrored horns, save the look as a preset, export the preset file and load it back in another browser.
```

---

## Phase 8 — Label

```
Ground rules: Read docs/DESIGN.md fully before doing anything. It is the source of truth. I'm new to coding and use Windows, so explain what you did in plain English and give PowerShell commands. If a big decision isn't covered by the design doc, ask me before guessing. At the end, update README.md, docs/DESIGN.md (if anything changed) and docs/PROGRESS.md.

Phase 8 goal: DESIGN.md §6.10.

1. Label section: shapes — banner/ribbon, plaque, pill, box (rounded or sharp) and curved text on the ring. Free drag positioning with snapping to top/bottom.
2. Shape colour, opacity and outline. Text: content (defaults to the token name), font, size, colour, outline, shadow, letter spacing, bold/italic, alignment. Sizes per grid square.
3. Bundle the curated open-licence fonts listed in DESIGN.md §6.10 with the site (not loaded from Google at runtime) and make sure the export waits for fonts to load. Font picker shows each font name in its own font.
4. Upload your own font (.ttf/.otf/.woff/.woff2) via the FontFace API, saved in IndexedDB.
5. Long names: shrink-to-fit option so text never spills off the shape.
6. Tests: export uses the chosen font (pixel test), curved text follows each shape, shrink-to-fit works.

Done when: I can add a ribbon label in a fantasy font, or curve the name around the ring, and the export matches.
```

---

## Phase 9 — Export and batch mode

```
Ground rules: Read docs/DESIGN.md fully before doing anything. It is the source of truth. I'm new to coding and use Windows, so explain what you did in plain English and give PowerShell commands. If a big decision isn't covered by the design doc, ask me before guessing. At the end, update README.md, docs/DESIGN.md (if anything changed) and docs/PROGRESS.md.

Phase 9 goal: DESIGN.md §6.11 and batch mode from §6.1.

1. Export panel: format (PNG, WebP, JPG with a fill-colour choice), resolution as pixels per square (128, 256, 400, 512, custom) with the final pixel size shown and a 4096 px cap, editable safe file name, Download and Copy to clipboard (with a clear fallback message where the browser can't copy images).
2. Batch mode switch: import several images at once (multi-file upload, multi-file drop, several links). One shared style for all; each image keeps its own transform, masks and name. A thumbnail strip to switch between them. "Export all" makes a ZIP.
3. Make big exports and batch ZIPs work on phones without freezing (Web Worker, progress bar).
4. Leave a clear place in the code for GIF export later (animated tokens) without building it.
5. Tests: every format and resolution matches the preview; file naming; batch ZIP contents; Playwright batch flow on desktop and phone.

Done when: I can drop in six goblin images, style one, see all six share the look, nudge each one's crop, and download a ZIP of six named tokens.
```

---

## Phase 10 — Polish, help content and launch

```
Ground rules: Read docs/DESIGN.md fully before doing anything. It is the source of truth. I'm new to coding and use Windows, so explain what you did in plain English and give PowerShell commands. If a big decision isn't covered by the design doc, ask me before guessing. At the end, update README.md, docs/DESIGN.md (if anything changed) and docs/PROGRESS.md.

Phase 10 goal: make it launch-ready.

1. Help content: fill every help tip with clear text and a small before/after image or short looping clip (WebP or MP4, kept small). Respect prefers-reduced-motion.
2. Phone pass: go through every section on a phone-sized screen and fix anything cramped, fiddly or slow. Touch targets at least 44 px.
3. Accessibility pass (DESIGN.md §10): keyboard use, focus, screen-reader labels, contrast in light and dark themes.
4. Performance: first load fast (lazy-load libraries, fonts and asset packs), smooth slider dragging on a mid-range phone.
5. First-time experience: an empty state that invites importing, with a sample image to try.
6. About page (with asset and font credits from ASSETS-CREDITS.md) and Privacy page (DESIGN.md §13).
7. Confirm the ad slot is present but switched off.
8. Final README: what the site does, how to run, test and deploy, and a "Future features" section copied from DESIGN.md §15.
9. Run every test, fix failures, and give me a short checklist to try myself before I share the site.

Done when: all tests pass and the site is live on Cloudflare Pages.
```

---

## Later (not phases yet)

From DESIGN.md §15 — don't build these until you decide to: AI background removal, AI auto pop-out, AI relighting, animated borders/overlays with GIF export, Pinterest board browsing, sending tokens to Owlbear/Foundry, condition-variant packs, accounts and cloud saving, premium asset packs, and switching adverts on. Items marked (paid?) in the design doc are candidates for a paid version.
