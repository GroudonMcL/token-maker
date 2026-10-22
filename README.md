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
- **Move the art:** drag it. **Zoom:** mouse wheel, or pinch on a touch screen. **Rotate:** the round handle above the art, or twist two fingers. The square corner handles resize it.
- The toolbar above the canvas has zoom, rotate 90°, flip, fit, fill, "Keep the frame filled" (lock) and reset.
- **Frame & shape** (right-hand panel, or the **Frame** tab on a phone): pick a shape, one of 27 frames, a colour, thickness and spacing.
- **Size:** Tiny to Gargantuan or Custom. The border stays the same thickness on the map at every size.
- **Image (Phase 3):** open the **Image** section (the **Image** tab on a phone).
  - **Brightness, Contrast, Saturation** are always there; **Advanced** has Hue, Temperature, Tint, Exposure, Highlights, Shadows, Sharpness, Blur, Vibrance, Grayscale, Sepia and Invert. **Reset adjustments** puts them all back.
  - **Remove flat background** makes a plain background see-through. The colour is found from the picture's edges; if it picks the wrong one, click **Pick colour** and click the background (**Auto** goes back). **Intensity** removes more or less; **Edge softness** softens the cut.
  - **Erase / restore brush:** click **Use the brush**, then paint on the picture. **Erase** hides what you paint, **Restore** brings it back. While the brush is on, removed parts show red inside the frame. Pick **Brush size** (Advanced: softness, pen pressure). Two fingers still move and zoom. Press **Done** (or `Esc`) to go back to moving the art. Each stroke is one undo step.
  - Nothing you do here changes your original picture, so you can always change your mind.
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
| `npm run help-images` | Redraws the before/after pictures in the Image help tips (`public/help/`). Run it after changing how an adjustment looks. |
| `npm run make-fixture` | Redraws the goblin test pictures in `e2e/fixtures/`. |
| `npm run frame-sheet -- sheet.png` | Draws every frame on one picture so you can check them by eye. Add a shape and size, e.g. `npm run frame-sheet -- sheet.png hexagon 220 2` for Large hexagons. |

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
src/render/            The renderer: shapes, the 27 frames, crop maths, render()
src/state/             Undo/redo history, the token store, images in memory, autosave
src/import/            Decoding images and naming tokens from file names
src/editor/            The canvas (Stage), toolbar actions, drop/paste, shortcuts, brush and eyedropper tools
src/sections/          Panel sections that are built (Import, Image, Frame & shape, Size, Export)
src/export/            PNG download
scripts/               frame-sheet.ts, make-fixture.ts (the test pictures), help-images.ts
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
