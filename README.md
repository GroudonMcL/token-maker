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
- **Feature flags:** under **Settings → Variables and Secrets** (Environment variables), add e.g. `VITE_FEATURE_ADS` = `true` and redeploy. The ad slot is off by default.

## 5. How the project is organised

```
docs/DESIGN.md         The design document (source of truth)
docs/PROGRESS.md       Checklist of phases
functions/api/         Cloudflare Pages Functions (server code). Only /api/health so far;
                       the image proxy (DESIGN.md §7) comes later.
public/                Files copied as-is (favicon, _headers for Cloudflare)
src/styles/tokens.css  Design tokens: every colour, font, size, radius and shadow
src/styles/app.css     The stylesheet for the whole UI
src/components/        Shared controls (Section, Slider, ColorSwatches, SegmentedButtons,
                       TileGrid, ImageStrip, Toggle, HelpTip)
src/help/helpContent.ts  Text for every "?" help tip
src/layout/            The editor layout (top bar, canvas, toolbar, side panel,
                       phone bottom sheet, bottom bar, ad slot, footer)
src/pages/             About, Privacy and the UI kit page
src/state/history.ts   Undo/redo history helper
src/config/features.ts Feature flags
e2e/                   Playwright end-to-end tests
```

### Adding a new control

1. Add its help text to `src/help/helpContent.ts`.
2. Use one of the shared components and pass that id as `helpId`.
3. `npm test` fails if you forget step 1.
