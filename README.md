# Token Maker

A free website for making tokens for D&D and other tabletop RPGs: import a picture, frame it, style it, and download it ready for a virtual tabletop. Everything runs in the browser.

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
- **Size:** Tiny to Gargantuan or Custom. The border stays the same thickness on the map at every size.
- **Image (Phase 3):** open the **Image** section (the **Image** tab on a phone).
  - **Brightness, Contrast, Saturation** are always there; **Advanced** has Hue, Temperature, Tint, Exposure, Highlights, Shadows, Sharpness, Blur, Vibrance, Grayscale, Sepia and Invert. **Reset adjustments** puts them all back.
  - **Remove flat background** makes a plain background see-through. The colour is found from the picture's edges; if it picks the wrong one, click **Pick colour** and click the background (**Auto** goes back). **Intensity** removes more or less; **Edge softness** softens the cut.
  - **Erase / restore brush:** click **Use the brush**, then paint on the picture. **Erase** hides what you paint, **Restore** brings it back. While the brush is on, the frame turns half see-through and removed parts show red inside it. Pick **Brush size** (Advanced: softness, pen pressure). Two fingers still move and zoom. Press **Done** (or `Esc`) to go back to moving the art. Each stroke is one undo step.
  - Nothing you do here changes your original picture, so you can always change your mind.
  - Hover over a control's name (or press and hold it on a phone) to see what it does, with a before/after picture.
- **Background (Phase 4):** what fills the frame behind the art.
  - **Colour**, **Gradient** (two colours, linear or radial; **Advanced** edits every colour stop), or **Picture**.
  - A picture can be one of 10 **built-in** scenes (forest, dungeon stone, parchment, night sky, lava, water, tavern wood, snow, swamp, desert), **your own** (upload, or paste a link), or the **token's art** (an enlarged, blurred copy).
  - **Blur** and **Zoom** change the picture only. **Move on the canvas** lets you drag it into place; **Reset position** centres it again.
- **Foreground (Phase 4):** add overlays drawn over the art inside the frame: Vignette, Gradient, Edge shadow, Mist, Smoke, Foliage and Cobwebs. Each has opacity and a blend mode (Multiply darkens, Screen lightens…), and most have colour, side, reach and scale. Use the arrows to reorder, the eye to hide, and the bin to remove. **Shuffle** rearranges leaves, smoke and webs.
- **Lighting (Phase 4):** pick a preset (Torchlight, Moonlight, Holy glow, Fel green, Firelight, Underdark) or switch on **Light the art** and set it yourself: drag the dot round the **direction dial**, choose a colour and strength, and add a **rim light** (a bright edge, best on a cut-out character) with its strength, width and **softness** (0 % is a crisp edge; higher fades it gently into the art). The background is lit too unless you turn that off. Changing a preset's settings keeps the light; it just isn't called by the preset's name any more.
- **Pop-out (Phase 5):** make parts of the art break over the border, like a dragon's horns. Zoom or move the art so those parts reach over the frame, press **Paint pop-out** and paint over them (they are tinted teal while you paint; **Show the pop-out mask** hides the tint). **Erase** on the canvas bar takes parts back. The painted parts stick to the art, so moving, zooming, turning or flipping it takes them along. **Pop-out on** switches it off without losing your painting, and **Clear pop-out** starts again. Remove a flat background first (Image section), or the background pops out too.
- **Shadows (Phase 5, in Lighting & shadows):** the **drop shadow** around the token (it includes pop-out parts), the **pop-out shadow** that pop-out parts cast onto the frame, and the **inner shadow** of the frame onto the art. Drop and pop-out shadows fall away from the light; switch off "follow the light" to set their direction, distance, blur, colour and opacity yourself. Sizes are per grid square, so a shadow looks the same on the map at every creature size.
- **Effects (Phase 6):** pick an effect from the picker (every tile is a live preview on your token's shape and frame; hover a name, or press and hold it, for a before/after picture) to add it to the stack: **Glows** (outer, inner), **Elemental** (fire, frost, poison, lightning, necrotic, radiant), **Conditions** (bloodied, petrified, ethereal, frightened, poisoned, charmed, unconscious) and **Atmosphere** (mist, embers, sparkles, smoke). Each effect has a **Placement** — *Behind art* (shows where the background was removed, e.g. a halo round a cut-out creature), *Over art* or *On border* — and an **Intensity**. **Advanced** adds colour, size (per grid square), spread and **Shuffle**. Stack as many as you like (up to 12); the arrows reorder them, the eye hides one and the bin removes it. Effects with the same placement are drawn in list order, top of the list last.
- **Picture frames (Phase 7, in Frame & shape):** switch **Frame type** to **Picture** and pick one of 8 built-in frames, or **Upload a frame** — any PNG with a see-through middle. The site finds the hole by itself and shows the art through it; if it doesn't quite fit, use **Hole size**, **Move hole sideways** and **Move hole up or down** (**Reset the hole** undoes the nudge). Your uploaded frames are kept in this browser and listed under *Your frames*. Unlike drawn frames, picture frames grow with the token.
- **Decorations (Phase 7):** add gems, a crown, stars, skulls, horns, wings, ribbons, laurels, chains, leaves and class icons. Each one snaps onto the frame and faces outwards; choose its **Position** on the 3 × 3 grid (eight snap points, or **Free** in the middle) and switch on **Mirror on the other side** for a matching pair (horns and wings start mirrored). **Tap or click it on the canvas** to drag it — it snaps to the nearest snap point (hold **Alt** to place it freely) — and use its square handle to resize and its round handle to turn it. Size (per grid square), rotation, tint, opacity and flip are in its card; `Delete` removes the picked one.
- **Presets (Phase 7):** one tap on a built-in preset (Boss, Undead, Party member, Minion, Fey, Fiend, Celestial, Construct) styles the frame, lighting, effects and decorations together; your art, name and size stay, and it's one undo step. **Save this look** keeps your own. In *Your presets*, tap a name to use it, the copy button gives a **text code** (it starts with `TKP1.`) and the download button a `.tokenpreset.json` file. **Add a shared preset** takes a pasted code or a file. Presets never contain your art (or your own background picture); a preset that uses an uploaded frame carries that frame's picture so it works in another browser.
- **Label (Phase 8):** **Add a label** puts the token's name on a banner across the bottom of the frame. Pick a **Shape** — Banner, Plaque, Pill, Box (rounded or sharp corners) or **Ring text**, which curves the name round the frame with no shape behind it. Leave **Text** empty to show the token's name, or type your own words. The **Font** list shows 15 fantasy fonts, each in its own lettering; they come with the site, so the download always uses the font you see. **Upload a font** adds your own `.ttf`, `.otf`, `.woff` or `.woff2` (kept in this browser, and carried along in presets you share). Text size, colour, bold/italic and alignment are up front; **Position** snaps it to the Top or Bottom of the frame, or **Free**. You can also **drag the label on the canvas** — it snaps to the top or bottom (hold **Alt** to place it freely); ring text slides round the ring. Width, banner **Bend**, shape colour, opacity and outline set the shape. **Shrink long names to fit** keeps long names on the shape (switched off, the shape grows instead). Advanced has letter spacing, a text outline and a text shadow. Sizes are per grid square, like the frame.
- **Undo/Redo:** the arrows in the top bar, or `Ctrl+Z` / `Ctrl+Y`. A whole drag counts as one step.
- **Export PNG** (bottom bar) downloads the token at 256 pixels per grid square.
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
| `npm run help-images` | Redraws the before/after pictures in the Image and Effects help tips (`public/help/`). Run it after changing how an adjustment or effect looks. |
| `npm run make-fixture` | Redraws the test pictures in `e2e/fixtures/` (the goblins and a purple ring frame). |
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
public/                Files copied as-is (favicon, _headers for Cloudflare)
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
src/sections/          Panel sections that are built (Import, Image, Background, Foreground, Lighting & shadows,
                       Pop-out, Effects, Frame & shape, Decorations, Size, Label, Presets, Export)
src/export/            PNG download
scripts/               frame-sheet.ts, effect-sheet.ts, decoration-sheet.ts, label-sheet.ts, make-fixture.ts (the test pictures),
                       help-images.ts, make-backgrounds.ts, make-frames.ts
src/styles/tokens.css  Design tokens: every colour, font, size, radius and shadow
src/styles/app.css     The stylesheet for the whole UI
src/components/        Shared controls (Section, Slider, ColorSwatches, SegmentedButtons,
                       TileGrid, ImageStrip, Toggle, HelpTip)
src/help/helpContent.ts  Text for every "?" help tip
src/layout/            The editor layout (top bar, canvas, toolbar, side panel,
                       phone bottom sheet, bottom bar, ad slot, footer)
src/pages/             About, Privacy and the UI kit page
src/config/features.ts Feature flags
e2e/                   Playwright end-to-end tests
```

### Adding a new control

1. Add its help text to `src/help/helpContent.ts`.
2. Use one of the shared components and pass that id as `helpId`.
3. `npm test` fails if you forget step 1.
