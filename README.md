# Token Maker

A free website for making tokens for D&D and other tabletop RPGs: import a picture, frame it, style it, and download it ready for a virtual tabletop (Owlbear Rodeo, Foundry VTT, Roll20…). Everything runs in the browser, on the visitor's own device: no accounts, no analytics, no cookies.

**What it does:** bring in a picture (upload, drop, paste, a web or Pinterest link, or the sample goblin) → move, crop and adjust it, remove its background (by colour or with in-browser AI), let parts pop out over the border → pick a shape and one of 27 drawn frames or a picture frame, add a background, lighting, shadows, effects (including overlays and picture effects), decorations and a name label, or start from a preset → download it as PNG or WebP at the size your VTT wants, or a whole batch as a ZIP. It works with a mouse, a touch screen or a pen, on a computer or a phone, and every control has a help card with a before/after picture.

- **Design document (read this first):** [`docs/DESIGN.md`](docs/DESIGN.md)
- **Progress checklist:** [`docs/PROGRESS.md`](docs/PROGRESS.md)
- **Asset credits:** [`ASSETS-CREDITS.md`](ASSETS-CREDITS.md)

---

## 1. One-time set-up on Windows

Open **PowerShell** (press Start, type `PowerShell`, press Enter) and run:

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

Close PowerShell and open it again so it picks up the new programs. Check they work:

```powershell
node -v   # should print v22 or newer
git --version
```

> If PowerShell later says **"running scripts is disabled on this system"** when you use `npm`, run this once and answer `Y`:
>
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```

Get the code and install its packages:

```powershell
cd $HOME\Documents
git clone https://github.com/GroudonMcL/token-maker.git
cd token-maker
npm install
npx playwright install chromium   # downloads the browser used by the end-to-end tests
```

## 2. Run it on your computer

```powershell
npm run dev
```

Open the address it prints (usually <http://localhost:5173>) in your browser. The page reloads by itself whenever you save a file. Press `Ctrl+C` in PowerShell to stop it.

To see the phone layout on your computer: in Chrome or Edge press `F12`, then click the phone/tablet icon (top left of the panel) and pick a phone.

### Using the editor

- **First time:** the empty token has **Upload image** and **Try a sample** buttons in the middle. *Try a sample* loads a goblin picture so you can play with every setting straight away.
- **Help:** every section has a **?**; hover over any control's name (or press and hold it on a phone) for a card saying what it does, with a before/after picture.
- **Get a picture in:** click **Upload image**, drag a picture file anywhere onto the page, or copy an image and press `Ctrl+V`.
- **From the web (Phase 2):** paste a link into **Web address** in the Import section and click **Get**. It can be:
  - a link straight to a picture (it loads at once),
  - a normal web page (its pictures appear in a row; click the one you want; tiny icons are hidden),
  - a Pinterest pin, including `pin.it` short links (the full-size picture loads).

  You can also paste a link anywhere on the page with `Ctrl+V`, or drag a picture from another browser tab onto the page. If a site won't share its pictures you'll get a message suggesting right-click → **Copy image address**, or saving the picture and uploading it.
- **Move the art:** drag it. **Resize:** the square corner handles, the toolbar's zoom slider, or pinch on a touch screen. **Rotate:** the round handle above the art, or twist two fingers.
- **Look closer:** scroll the mouse wheel over the token to zoom the view in (the art itself doesn't change). Hold Space or the middle mouse button and drag to look around, and click **View … · Reset** to see the whole token again. Scrolling anywhere else over the canvas scrolls the settings panel.
- The toolbar above the canvas has zoom, rotate 90°, flip sideways, flip upside down, fit, fill and reset.
- Only one settings section is open at a time. Sliders have a small notch under them marking the default value. Frames with details in their own colour (like the beads on Monk) have a **Frame highlights colour** option.
- **Frame & shape** (right-hand panel, or the **Frame** tab on a phone): pick a shape, one of 27 frames, a colour, thickness and spacing.
- **Size:** Tiny (half a square), Small (0.8 of a square), Medium to Gargantuan, or Custom. The border stays the same thickness on the map at every size.
- **The panel:** the **Menu style** switch above Import picks **Simple** (no Advanced settings), **Advanced** (closed Advanced drop-downs) or **Expert** (every setting on show). On a computer, drag the panel's left edge to make it wider or narrower (double-click the edge to reset). Every slider has a small **reset** arrow beside its value. The moon/sun button switches between the dark look (the default) and the light look.
- **Image (Phase 3):** open the **Image** section (the **Image** tab on a phone).
  - **Brightness, Contrast, Saturation** are always there; **Advanced** has Hue, Temperature, Tint, Exposure, Highlights, Shadows, Sharpness, Blur, Vibrance, Grayscale, Sepia and Invert. **Reset adjustments** puts them all back.
  - **Erase / restore brush:** click **Use the brush**, then paint on the picture. **Erase** hides what you paint, **Restore** brings it back. While the brush is on, the frame turns half see-through and removed parts show red inside it. Pick **Brush size** (Advanced: softness, pen pressure). Two fingers still move and zoom. Press **Done** (or `Esc`) to go back to moving the art. Each stroke is one undo step.
  - Nothing you do here changes your original picture, so you can always change your mind.
  - Hover over a control's name (or press and hold it on a phone) to see what it does, with a before/after picture.
- **Background (Phase 4):** removing the picture's own background, and what fills the frame behind the art.
  - **Remove background** (moved here from Image): **Flat colour** makes a plain background see-through. The colour is found from the picture's edges; if it picks the wrong one, click **Pick colour** and click the background (**Auto** goes back). **Intensity** removes more or less, and **Remove enclosed gaps too** also takes patches of that colour cut off from the edge (like the gap between an arm and a staff). **AI** finds the character on any background with a model that runs in the browser (BiRefNet-lite; about 100 MB, downloaded once from Hugging Face, and the picture never leaves the device). Each picture keeps its own AI cut-out. **Edge softness** softens the cut either way.
  - **Colour**, **Gradient** (two colours, linear or radial; **Advanced** edits every colour stop), or **Picture**.
  - A picture can be one of 10 **built-in** scenes (forest, dungeon stone, parchment, night sky, lava, water, tavern wood, snow, swamp, desert), **your own** (upload, or paste a link), or the **token's art** (an enlarged, blurred copy).
  - **Blur** and **Zoom** change the picture only. **Move on the canvas** lets you drag it into place; **Reset position** centres it again.
- **Lighting (Phase 4):** pick a preset (Torchlight, Moonlight, Holy glow, Fel green, Firelight, Underdark) or switch on **Light the art** and set it yourself: drag the dot round the **direction dial**, choose a colour and strength, and add a **rim light** (a bright edge, best on a cut-out character) with its strength, width and **softness** (0 % is a crisp edge; higher fades it gently into the art). The background is lit too unless you turn that off. Changing a preset's settings keeps the light; it just isn't called by the preset's name any more.
- **Pop-out (Phase 5):** make parts of the art break over the border, like a dragon's horns. Zoom or move the art so those parts reach over the frame, press **Paint pop-out** and paint over them (they are tinted teal while you paint; **Show the pop-out mask** hides the tint). **Erase** on the canvas bar takes parts back. The painted parts stick to the art, so moving, zooming, turning or flipping it takes them along. **Pop-out on** switches it off without losing your painting, and **Clear pop-out** starts again. Remove a flat background first (Image section), or the background pops out too.
- **Shadows (Phase 5, in Lighting & shadows):** the **drop shadow** around the token (it includes pop-out parts), the **pop-out shadow** that pop-out parts cast onto the frame, and the **inner shadow** of the frame onto the art. Drop and pop-out shadows fall away from the light; switch off "follow the light" to set their direction, distance, blur, colour and opacity yourself. Sizes are per grid square, so a shadow looks the same on the map at every creature size.
- **Effects (Phase 6):** pick an effect from the picker (every tile is a live preview on your token's shape and frame; hover a name, or press and hold it, for a before/after picture) to add it to the stack: **Glows** (outer, inner), **Elemental** (fire, frost, poison, lightning, necrotic, radiant), **Conditions** (bloodied, petrified, ethereal, frightened, poisoned, charmed, unconscious) **Atmosphere** (mist, embers, sparkles, smoke), **Overlays** (vignette, gradient, edge shadow, foliage, cobwebs — the old Foreground section) and **Pictures** (12 free sprites such as smoke puffs, flame licks, twinkles, claw marks and splatter, scattered round the token in any colour, or **Use your own picture**, scattered or filling the area). Each effect has a **Placement** — *Behind art* (shows where the background was removed, e.g. a halo round a cut-out creature), *Over art* or *On border* — an **Intensity** and a **Blur**. **Advanced** adds size (per grid square), spread, softness, **Blend mode** and **Shuffle**. Stack up to 20; the arrows reorder them, the eye hides one and the bin removes it. Effects with the same placement are drawn in list order, top of the list last.
- **Picture frames (Phase 7, in Frame & shape):** switch **Frame type** to **Picture** and pick one of 8 built-in frames, or **Upload a frame** — any PNG with a see-through middle. The site finds the hole by itself and shows the art through it; if it doesn't quite fit, use **Hole size**, **Move hole sideways** and **Move hole up or down** (**Reset the hole** undoes the nudge). Your uploaded frames are kept in this browser and listed under *Your frames*. Unlike drawn frames, picture frames grow with the token.
- **Frame Studio designs (in Frame & shape):** switch **Frame type** to **Frame Studio** and press **Open a Frame Studio design** to use a `.framestudio.json` file saved in [Frame Studio](https://github.com/GroudonMcL/Frame-Studio) as the frame. It follows the token's shape, thickness and spacing like a drawn frame, and looks exactly as it does in Frame Studio. Opened designs are kept in this browser to pick again, and presets carry them.
- **Decorations (Phase 7):** add gems, a crown, stars, skulls, horns, wings, ribbons, laurels, chains, leaves and class icons, or a **picture**: 14 flat icons (heart, skull, potion, hourglass…) in any colour, or **your own picture** (kept in this browser, and carried along in presets you share). Each one snaps onto the frame and faces outwards; choose its **Position** on the 3 × 3 grid (eight snap points, or **Free** in the middle) and switch on **Mirror on the other side** for a matching pair (horns and wings start mirrored). **Tap or click it on the canvas** to drag it — it snaps to the nearest snap point (hold **Alt** to place it freely) — and use its square handle to resize and its round handle to turn it. Size (per grid square), rotation, tint, opacity and flip are in its card; `Delete` removes the picked one.
- **Presets (Phase 7):** one tap on a built-in preset (Boss, Undead, Party member, Minion, Fey, Fiend, Celestial, Construct) styles the frame, lighting, effects and decorations together; your art, name and size stay, and it's one undo step. **Save this look** keeps your own. In *Your presets*, tap a name to use it, the copy button gives a **text code** (it starts with `TKP1.`) and the download button a `.tokenpreset.json` file. **Add a shared preset** takes a pasted code or a file. Presets never contain your art (or your own background picture); a preset that uses an uploaded frame carries that frame's picture so it works in another browser.
- **Label (Phase 8):** **Add a label** puts the token's name on a banner across the bottom of the frame. Pick a **Shape** — Banner, Plaque, Pill, Box (rounded or sharp corners), **Plain text** (no shape) or **Ring text**, which curves the name round the frame with no shape behind it. Leave **Text** empty to show the token's name, or type your own words. The **Font** list shows 15 fantasy fonts, each in its own lettering; they come with the site, so the download always uses the font you see. **Upload a font** adds your own `.ttf`, `.otf`, `.woff` or `.woff2` (kept in this browser, and carried along in presets you share). Text size, colour, bold/italic and alignment are up front; **Position** snaps it to the Top or Bottom of the frame, or **Free**; a free label has an **Anchor point** (which corner, edge or middle sits at its position) and a **Rotation** round that point. You can also **drag the label on the canvas** — it snaps to the top or bottom (hold **Alt** to place it freely); ring text slides round the ring. Width, banner **Bend**, shape colour, opacity and outline set the shape. **Shrink long names to fit** keeps long names on the shape (switched off, the shape grows instead). Advanced has letter spacing, a text outline and a text shadow. Sizes are per grid square, like the frame.
- **Undo/Redo:** the arrows in the top bar, or `Ctrl+Z` / `Ctrl+Y`. A whole drag counts as one step.
- **Export (Phase 9):** the Export section chooses the **Format** — PNG (see-through, works everywhere) or WebP (see-through and smaller) — and **Pixels per square** (128, 256, 400, 512 or Custom). It shows the final size, which is never more than 4096 px across. The **File name** starts as the token's name and only keeps safe characters. **Download** saves the file; **Copy to clipboard** copies a PNG to paste straight into a VTT (where the browser can't copy pictures, it says so — use Download). Advanced has a **Quality** slider for WebP. The **Export** button in the bottom bar uses the same choices.
- **Batch mode (Phase 9):** switch on **Batch** in the top bar, then upload, drop or paste several pictures at once (or paste several links, separated by spaces). They appear in a strip of thumbnails under the token (above it on phones). Everything you style — frame, effects, lighting, adjustments, label style… — applies to every token; each picture keeps its own position, zoom, rotation, flips, brush work, pop-out and name. Tap a thumbnail to work on that one. **Export all** (bottom bar, or the Export section) makes a ZIP with one file per token, named after each token, with a progress bar and a Stop button. Switching Batch off keeps only the token on screen.
- Your token is saved in the browser as you work, so refreshing the page keeps it. **New** starts again.

`npm run dev` also runs the web-import server code (the `/api/...` addresses), so importing from links works on your computer straight away.

Useful pages while developing:

- `/` — the editor
- `/kit` — every shared control in one place (the "UI kit"), wired to a real undo history
- `/about`, `/privacy`

## 3. Check everything works

| Command | What it does |
|---|---|
| `npm test` | Runs the unit tests (Vitest). |
| `npm run e2e` | Opens the site in a hidden browser at desktop, tablet and phone sizes and clicks through it (Playwright). Starts the dev server by itself. |
| `npm run typecheck` | Checks the TypeScript for mistakes. |
| `npm run lint` | Checks code style and common bugs (ESLint). |
| `npm run build` | Builds the finished site into the `dist` folder (this is what Cloudflare runs). |
| `npm run preview` | Serves the built `dist` folder so you can try the real build. |
| `npm run make-backgrounds` | Redraws the 10 built-in background pictures (`public/backgrounds/`). They're drawn by code, so nothing needs crediting. |
| `npm run make-frames` | Redraws the 8 built-in picture frames (`public/frames/`). They're drawn by code, so nothing needs crediting. |
| `npm run decoration-sheet -- decor.png` | Draws every decoration and every built-in picture frame on one picture, using the real renderer and hole finder. |
| `npm run label-sheet -- labels.png` | Draws every label shape, ring text on every token shape, long names and every bundled font on one picture, with the site's own font files. |
| `npm run help-images` | Redraws the before/after picture in every help tip (`public/help/`), with the real renderer. Run it after changing how something looks. |
| `npm run make-fixture` | Redraws the test pictures in `e2e/fixtures/` (the goblins and a purple ring frame) and the "Try a sample" goblin (`public/sample/`). |
| `npm run frame-sheet -- sheet.png` | Draws every frame on one picture so you can check them by eye. Add a shape and size, e.g. `npm run frame-sheet -- sheet.png hexagon 220 2` for Large hexagons. |
| `npm run effect-sheet -- effects.png` | Draws every effect behind the art, over the art and on the border on one picture. Takes the same shape, size and squares options as the frame sheet. |

### Testing the server functions the way Cloudflare runs them

`npm run dev` runs the server code inside Vite, which is quick and fine for everyday work. To try it in Cloudflare's own engine (the same one used on the live site), run:

```powershell
npm run pages:dev
```

This builds the site, then starts Cloudflare's **Wrangler** tool (downloaded automatically the first time, which takes a minute) at <http://localhost:8788>. Open that address and use the site as normal, or try the server directly in your browser:

- <http://localhost:8788/api/health> shows `{"ok":true}`
- <http://localhost:8788/api/page-images?url=https://en.wikipedia.org/wiki/Goblin> lists the pictures on that page
- <http://localhost:8788/api/fetch-image?url=https://127.0.0.1/a.png> is refused (private addresses are blocked)

Press `Ctrl+C` to stop it. If Windows Firewall asks about `workerd`, allowing private networks is enough.

Run them all before pushing:

```powershell
npm run typecheck; npm run lint; npm test; npm run e2e; npm run build
```

## 4. Deploy to Cloudflare Pages (from GitHub, no command line)

Cloudflare builds and publishes the site every time you push to GitHub. You only set this up once.

1. Make sure the code you want live is on the **`main`** branch on GitHub (merge your pull request first).
2. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com).
3. In the left menu, choose **Workers & Pages** (under *Compute*), then click **Create** (or **Create application**).
4. Choose the **Pages** option. Cloudflare may show Workers first; look for the **Pages** tab or a link like *"Looking to deploy Pages? Get started"*. Then pick **Import an existing Git repository** (also called **Connect to Git**).
5. Click **Connect GitHub** and allow Cloudflare to see the `token-maker` repository (you can allow just this one repository). Select it and click **Begin setup**.
6. Fill in the build settings:
   - **Project name:** `token-maker` (this becomes `token-maker.pages.dev`)
   - **Production branch:** `main`
   - **Framework preset:** `React (Vite)` (or `None`)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** leave empty
   - **Environment variables:** none needed. (The Node version comes from the `.node-version` file.)
7. Click **Save and Deploy**. The first build takes a minute or two. When it finishes, click the `*.pages.dev` link.
8. Check the server part works by visiting `https://<your-project>.pages.dev/api/health`. It should show `{"ok":true}`.

**Deployed as a Worker instead?** Cloudflare now shows *Workers* first, and a site created there (a `*.workers.dev` address) used to answer `/api/...` with the editor's own page, so web and Pinterest links failed ("Unexpected token '<'…" or "That isn't an image file"). The repository now includes `wrangler.jsonc` and `worker/index.ts`, so a Workers deploy serves the image server too: set the build command to `npm run build` and the deploy command to `npx wrangler deploy`, push, and check `https://<your-worker>.workers.dev/api/health` shows `{"ok":true}`. Pages ignores those two files. If `/api/health` shows the editor's page instead, the image server isn't running and the editor says so when you paste a link.

After that:

- **Every push to `main`** updates the live site.
- **Every other branch / pull request** gets its own preview link (shown on the pull request and in the Cloudflare dashboard under *Deployments*).
- **Custom domain:** in the project, open **Custom domains → Set up a custom domain**.
- **Extra rate limiting (optional):** the image server already limits each visitor to about 20 page look-ups and 90 images a minute. For a firmer limit, in the Cloudflare dashboard open your domain → **Security → WAF → Rate limiting rules**, and add a rule for URI path starting with `/api/`. (This needs a custom domain; it isn't available on `*.pages.dev`.)
- **Feature flags:** under **Settings → Variables and Secrets** (Environment variables), add e.g. `VITE_FEATURE_ADS` = `true` and redeploy. The ad slot is off by default.

## 5. How the project is organised

```
docs/DESIGN.md         The design document (source of truth)
docs/PROGRESS.md       Checklist of phases
functions/api/         Cloudflare Pages Functions: /api/fetch-image, /api/page-images, /api/health.
                       Each is a few lines that call server/.
server/                The image proxy (DESIGN.md §7): safety rules (safeFetch.ts, ipRanges.ts),
                       finding images in a page (extractImages.ts), Pinterest pins (pinterest.ts),
                       rate limiting, and devApi.ts (runs it inside `npm run dev`).
                       server/fixtures/ holds saved sample pages for the tests.
public/                Files copied as-is (favicon, _headers for Cloudflare), built-in backgrounds and frames,
                       help pictures (help/) and the sample goblin (sample/)
src/document/          The TokenDocument: types, defaults, migrations, per-square sizing
src/render/            The renderer: shapes, the 27 frames, crop maths, render(), and the effects
                       (effects.ts places and caches them; effectPainters.ts draws each one),
                       picture frames (imageFrames.ts) and decorations (decorations.ts places them;
                       decorationPainters.ts draws each one) and the label (label.ts)
src/fonts/             Label fonts: the list (catalog.ts), the bundled files (fontFiles.ts) and loading
                       them, plus your uploaded fonts in IndexedDB (fontLoader.ts)
src/presets/           Presets: the file and text-code format and its migrations (preset.ts),
                       the built-in presets (builtins.ts) and "Your presets" in IndexedDB (presetStore.ts)
src/state/             Undo/redo history, the token store, images in memory, autosave,
                       picture frames (frameLibrary.ts: built-ins and your uploads in IndexedDB)
src/import/            Decoding images and naming tokens from file names
src/editor/            The canvas (Stage), toolbar actions, drop/paste, shortcuts, brush, pop-out brush and eyedropper tools
src/sections/          Panel sections (Import, Image, Background, Frame & shape, Pop-out, Lighting & shadows,
                       Pop-out, Effects, Frame & shape, Decorations, Size, Label, Presets, Export).
                       index.tsx loads all but Import lazily, in the background, for a quick first load
src/export/            Export: formats and sizes (formats.ts), the panel's remembered choices and safe file names
                       (exportSettings.ts), render → encode → download/copy (exportToken.ts), the ZIP Web Worker
                       (zip.worker.ts, zip.ts) and the place for animated GIF export later (animated.ts)
src/batch/             Batch mode: the pictures and what each keeps for itself (batch.ts), the thumbnail strip
scripts/               frame-sheet.ts, effect-sheet.ts, decoration-sheet.ts, label-sheet.ts, make-fixture.ts (the test pictures),
                       help-images.ts + help-token-pictures.ts (help pictures), make-backgrounds.ts, make-frames.ts
src/styles/tokens.css  Design tokens: every colour, font, size, radius and shadow
src/styles/app.css     The stylesheet for the whole UI
src/components/        Shared controls (Section, Slider, ColorSwatches, SegmentedButtons,
                       TileGrid, ImageStrip, Toggle, HelpTip)
src/help/helpContent.ts  Text for every "?" help tip
src/layout/            The editor layout (top bar, canvas, toolbar, side panel,
                       phone bottom sheet, bottom bar, ad slot, footer)
src/pages/             About (credits read from ASSETS-CREDITS.md by credits.ts), Privacy and the UI kit page
src/config/features.ts Feature flags
e2e/                   Playwright end-to-end tests
```

### Adding a new control

1. Add its help text to `src/help/helpContent.ts`, with `media: beforeAfter('<id with - for .>', '<what changes>')`.
2. Draw its before/after picture in `scripts/help-token-pictures.ts` (or `help-images.ts` for the Image and Effects sections) and run `npm run help-images`.
3. Use one of the shared components and pass that id as `helpId`.
4. `npm test` fails if you forget step 1 or 2.

## 6. Before you share the site: a checklist to try yourself

Do these on the live site (your `*.pages.dev` address), once on your computer and once on your phone. Each takes a minute or two.

1. **First visit:** open the site in a private/incognito window. You should see the empty token with **Upload image** and **Try a sample**. Press **Try a sample** — the goblin appears.
2. **Your own picture:** upload a picture from your device, then drag it, pinch or use the corner handles to fit it in the frame.
3. **From the web:** paste a link to a picture (right-click a picture on a website → *Copy image address*) into **Web address** and press **Get**. Try a Pinterest pin link too.
4. **Style it:** pick a preset (Presets section), change the frame colour, add an effect and a label. Undo (`Ctrl+Z`, or the arrow in the top bar) and redo.
5. **Help cards:** hover over a few control names (press and hold on a phone) and check the pictures show.
6. **Download:** press **Export** and open the file. Check it looks like the preview, with see-through corners for PNG. Try **Copy to clipboard** and paste it into your VTT.
7. **In your VTT:** drop the token onto a map and check it lines up with the grid (try a Large token too).
8. **Batch:** switch **Batch** on, upload three pictures, style them, then **Export all** — you get a ZIP with one file per token.
9. **Refresh:** reload the page — your token is still there. **New** clears it.
10. **Phone:** open the tabs along the bottom, drag the sheet up and down, and make sure nothing is hard to tap.
11. **Dark and light:** press the theme button (top right) and check both look right.
12. **About and Privacy:** the links at the bottom of the page work and say what you expect.

If anything looks wrong, take a screenshot and describe what you did — that's all an AI (or a person) needs to fix it.

## 7. Future features

Copied from [DESIGN.md §15](docs/DESIGN.md#15-future-features-not-in-version-1). None of these are built yet; don't start them until you decide to. **(paid?)** marks candidates for a paid version of the tool.

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
| Adverts | Slot already reserved below the editor (§8); switch on with `VITE_FEATURE_ADS=true` (section 4). |
