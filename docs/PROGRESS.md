# Progress

A checklist of build phases. Tick a phase when it is finished and its "done when" checks pass.

> Phase 0 came from the owner. Phases 1–13 are a **suggested** order based on `docs/DESIGN.md`; replace them with the owner's own phase list when it arrives.

- [x] **Phase 0 — Project setup, visual design and layout shell**
  - [x] Vite + React + TypeScript, Vitest, Playwright; npm scripts `dev`, `build`, `test`, `e2e`, `typecheck`, `lint`
  - [x] Cloudflare Pages set-up with a `/functions` folder (placeholder `/api/health`); dashboard deploy steps in README
  - [x] Visual identity chosen ("Lamplit Workbench" + navy sky) and recorded in DESIGN.md §9 and `src/styles/tokens.css`
  - [x] Layout shell for desktop, tablet and phone (top bar, canvas + floating toolbar, side panel sections, bottom sheet with tabs, bottom bar with Export)
  - [x] Shared components: Section + Advanced, Slider, colour swatches + picker, segmented buttons, tile grid, image strip, toggle, HelpTip
  - [x] Help text in `src/help/helpContent.ts` with a test for missing entries
  - [x] Ad slot below the editor behind the `ads` flag (off)
  - [x] Placeholder About and Privacy pages
- [ ] Phase 1 — TokenDocument, store (undo/redo, autosave) and the renderer core (shapes, 27 code-drawn frames ported from the extension, frame sheet)
- [ ] Phase 2 — Import: upload, drag and drop, paste; crop/transform on the canvas
- [ ] Phase 3 — Image editing: adjustments, flat background removal, erase/restore brush
- [ ] Phase 4 — Image proxy (web address, page images, Pinterest) and batch mode
- [ ] Phase 5 — Background and foreground overlays
- [ ] Phase 6 — Lighting and shadows
- [ ] Phase 7 — Pop-out
- [ ] Phase 8 — Styles and effects
- [ ] Phase 9 — Image (PNG) frames and decorations
- [ ] Phase 10 — Label and bundled fonts
- [ ] Phase 11 — Presets (built-in, saved, shared)
- [ ] Phase 12 — Export (PNG/WebP/JPG, clipboard, ZIP)
- [ ] Phase 13 — Polish: help pictures/clips, credits, accessibility check, launch
