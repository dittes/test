# Test Institute

A static, local-first collection of 26 browser tools and games, including device checks, reaction time, sequence memory, aim, number memory, verbal memory and typing. Vanilla HTML/CSS/JavaScript at runtime, with a dependency-free Node build.

## Run locally

Use Node 22 or newer.

```sh
npm run dev
```

Open `http://localhost:4173`. The server rebuilds when files in `assets/`, `content/`, or `scripts/` change. Refresh the browser to see an update. Camera and microphone require HTTPS in production; loopback localhost is supported for development.

## Build

```sh
npm run build
```

Deploy the contents of `dist/` to a static host. It includes generated HTML, assets, canonical metadata, sitemap, robots.txt, a custom 404, `.nojekyll`, and the existing domain's CNAME. No client framework, CDN, external font, analytics, cookies, or install step is required.

### This GitHub repository

The published HTML lives at the repository root. Source files, scripts and tests are now included in the same checkout so future changes do not get stranded in a separate folder. After editing source files, run:

```sh
npm run build:site
npm test
```

`build:site` first builds `dist/`, then updates the known generated pages at the repository root. Runtime assets and `tokens.css` already live at the root and are used directly. This command does not commit, push, delete files, or copy Git metadata. Review and commit the source and generated-page changes together. `dist/` and local test screenshots are ignored.

- `content/pages.json` plus generated browser-check entries in `scripts/build.mjs`: the tools' SEO metadata, instructions, methods, troubleshooting, FAQs, and related links.
- `scripts/build.mjs`: templates, homepage, support pages, and production output.
- `assets/site.css`: shared visual design and responsive layout.
- `assets/media-tools.js`: permission-gated camera/microphone and stereo audio tests.
- `assets/input-tools.js`: keyboard, pointer, and full-screen display tests.

The build preserves `/headphone-test/`. Before replacing the existing production site, preserve its operator/imprint details and map any other existing public URLs. Publishing and DNS changes are not part of this local build.

## Verification

```sh
npm run build
npm test
```

`scripts/browser-check.mjs` adds interaction, responsive, metadata, permission-denial, cancellation, and stream-cleanup checks using Playwright and installed Chrome. It uses simulated camera/microphone devices; it does not access your physical camera or microphone. With Playwright available:

```sh
node scripts/browser-check.mjs
```

If Playwright is provided by a shared runtime, set `PLAYWRIGHT_MODULE` to its absolute `index.mjs` path. Run the local server first. Screenshots go into ignored `test-results/`.

Automated media tests do not establish hardware audio fidelity or actual camera quality. Physical-device checks in Safari, Firefox, iOS, and Android remain part of release QA.

## Data handling and method boundaries

Device permission is requested only on Start. Pending requests can be cancelled; late streams are stopped. Stop, hiding the page, and page navigation release media. Microphone recordings are capped at 15 seconds and removed on Stop. No media or input events leave the browser.

Camera FPS is a reported setting, microphone levels are relative digital dBFS, headphone results are user confirmations, and display checks are visual inspections. These tools do not certify or diagnose hardware.

## Brain games

`/brain-tests/` collects six working games. Five new routes accompany the updated `/reaction-time-test/`: `/sequence-memory-test/`, `/aim-test/`, `/number-memory-test/`, `/verbal-memory-test/`, and `/typing-test/`.

- `content/brain-pages.mjs`: original SEO titles, descriptions, instructions, scoring methods, limitations and FAQs; text is generated into static HTML.
- `content/brain-icons.mjs`: original illustrations reused on cards and page headings.
- `assets/brain-tools.js` and `assets/brain-tools.css`: responsive interactive games, local-only scores, reset controls and cancellation on loss of page focus.
- `assets/brain-core.js`: scoring helpers, digit generation, target placement and original typing passage.
- `tests/brain.test.mjs`: scoring, random-draw invariants, bounds and generated-page checks.

Reaction uses five valid samples and a median; aim uses 20 hits and counts misses. Number memory ends at the first incorrect recall or 20 digits. Verbal memory ends after three mistakes or 60 decisions. Typing runs for 60 seconds from the first input, unless the whole passage is copied correctly sooner. These are practice games, not standardized cognitive, IQ or medical assessments. No percentile or health claims are made; no scores are persisted or uploaded.

Browser QA includes end-to-end runs and small-screen layout checks. Physical touch-device testing and cross-browser timing comparisons remain release checks; browser timings are not laboratory measurements.
