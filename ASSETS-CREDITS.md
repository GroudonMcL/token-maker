# Asset credits

Every font, icon, image and other asset bundled with Token Maker, with its source and licence (DESIGN.md §12). The About page shows this table as it is, so keep it a plain table: one row per asset, links written as `[text](https://…)`.

| Asset | Source | Licence |
|---|---|---|
| Grenze (font) | Omnibus-Type, via [@fontsource/grenze](https://fontsource.org/fonts/grenze) | SIL Open Font License 1.1 |
| Atkinson Hyperlegible (font) | Braille Institute, via [@fontsource/atkinson-hyperlegible](https://fontsource.org/fonts/atkinson-hyperlegible) | SIL Open Font License 1.1 |
| Cinzel (label font) | Natanael Gama, via [@fontsource/cinzel](https://fontsource.org/fonts/cinzel) | SIL Open Font License 1.1 |
| Cinzel Decorative (label font) | Natanael Gama, via [@fontsource/cinzel-decorative](https://fontsource.org/fonts/cinzel-decorative) | SIL Open Font License 1.1 |
| IM Fell English (label font) | Igino Marini, via [@fontsource/im-fell-english](https://fontsource.org/fonts/im-fell-english) | SIL Open Font License 1.1 |
| MedievalSharp (label font) | Wojciech Kalinowski, via [@fontsource/medievalsharp](https://fontsource.org/fonts/medievalsharp) | SIL Open Font License 1.1 |
| Pirata One (label font) | Rodrigo Fuenzalida, Nicolas Massi, via [@fontsource/pirata-one](https://fontsource.org/fonts/pirata-one) | SIL Open Font License 1.1 |
| UnifrakturMaguntia (label font) | J. "Mach" Wust, via [@fontsource/unifrakturmaguntia](https://fontsource.org/fonts/unifrakturmaguntia) | SIL Open Font License 1.1 |
| Uncial Antiqua (label font) | Astigmatic, via [@fontsource/uncial-antiqua](https://fontsource.org/fonts/uncial-antiqua) | SIL Open Font License 1.1 |
| Almendra (label font) | Ana Sanfelippo, via [@fontsource/almendra](https://fontsource.org/fonts/almendra) | SIL Open Font License 1.1 |
| Metamorphous (label font) | James Grieshaber, via [@fontsource/metamorphous](https://fontsource.org/fonts/metamorphous) | SIL Open Font License 1.1 |
| Grenze Gotisch (label font) | Omnibus-Type, via [@fontsource/grenze-gotisch](https://fontsource.org/fonts/grenze-gotisch) | SIL Open Font License 1.1 |
| Macondo (label font) | John Vargas Beltrán, via [@fontsource/macondo](https://fontsource.org/fonts/macondo) | SIL Open Font License 1.1 |
| Alegreya SC (label font) | Juan Pablo del Peral, Huerta Tipográfica, via [@fontsource/alegreya-sc](https://fontsource.org/fonts/alegreya-sc) | SIL Open Font License 1.1 |
| Spectral (label font) | Production Type, via [@fontsource/spectral](https://fontsource.org/fonts/spectral) | SIL Open Font License 1.1 |
| Germania One (label font) | John Vargas Beltrán, via [@fontsource/germania-one](https://fontsource.org/fonts/germania-one) | SIL Open Font License 1.1 |
| Eagle Lake (label font) | Astigmatic, via [@fontsource/eagle-lake](https://fontsource.org/fonts/eagle-lake) | SIL Open Font License 1.1 |
| 12 picture-effect sprites (`public/pictures/fx-*.webp`) | Kenney, [Particle Pack](https://kenney.nl/assets/particle-pack) (cropped and resized) | CC0 1.0 |
| 14 picture-decoration icons (`public/pictures/deco-*.webp`) | Kenney, [Board Game Icons](https://kenney.nl/assets/board-game-icons) (drawn from the SVGs with a dark outline added) | CC0 1.0 |
| AI background-removal model (downloaded by the browser when used, not bundled) | [BiRefNet-lite](https://github.com/ZhengPeng7/BiRefNet) by Zheng Peng et al., 512 × 512 ONNX export [studioludens/birefnet-lite-512](https://huggingface.co/studioludens/birefnet-lite-512), run with [Transformers.js](https://github.com/huggingface/transformers.js) | MIT (model); Apache 2.0 (Transformers.js) |
| AI cut-out test picture (`e2e/fixtures/goblin-boss-ai-mask.png`) | Made once from the goblin fixture with the model above | — |
| 48 ornament icons in Frame Studio designs (`src/frameStudio/project/iconGlyphs.ts`) | Lorc, Delapouite, Carl Olsen and Caro Asercion, [game-icons.net](https://game-icons.net) (each icon's page is listed in that file and in [Frame Studio's credits](https://github.com/GroudonMcL/Frame-Studio/blob/main/docs/CREDITS.md)) | CC BY 3.0 |
| 20 photo textures in Frame Studio designs (`src/frameStudio/render/pictureData.ts`) | [Poly Haven](https://polyhaven.com) and [ambientCG](https://ambientcg.com) (resized to 512 px; each photo's page is in `src/frameStudio/project/pictures.ts`) | CC0 1.0 |
| Lucide icons | [lucide.dev](https://lucide.dev) (`lucide-react`) | ISC |
| Placeholder logo / favicon | Made for the project | — |
| 27 code-drawn frames and 5 shapes | Ported from the owner's own [LK-to-Owlbear-Combined](https://github.com/GroudonMcL/LK-to-Owlbear-Combined) extension | Owner's own code |
| 10 built-in background pictures (`public/backgrounds/`) | Drawn by code for the project (`scripts/make-backgrounds.ts`) | — (made for the project; no attribution needed) |
| 8 built-in picture frames (`public/frames/`) | Drawn by code for the project (`scripts/make-frames.ts`) | — (made for the project; no attribution needed) |
| 18 decorations (gems, crown, star, skull, horn, wing, ribbon, laurel, chain, leaf, class icons) | Drawn by code at render time (`src/render/decorationPainters.ts`) | — |
| Label shapes (banner, plaque, pill, box) | Drawn by code at render time (`src/render/label.ts`) | — |
| Overlay effects (foliage, smoke, mist, cobwebs, vignette, edge shadow) | Drawn by code at render time (`src/render/overlays.ts`) | — |
| Sample art in frame tiles, frame sheet and tests | Drawn by code for the project (`src/render/sampleArt.ts`, `scripts/make-fixture.ts`) | — |
| "Try a sample" goblin picture (`public/sample/goblin.png`) | Drawn by code for the project (`scripts/make-fixture.ts`) | — |
| Help-tip before/after pictures (`public/help/`) | Drawn by the site's own renderer (`scripts/help-images.ts`, `scripts/help-token-pictures.ts`) | — |
