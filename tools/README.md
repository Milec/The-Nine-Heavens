# tools/ — headless browser for the web UI

Lets Claude (or you) load the `web/` PWA in headless Chromium, click through it,
and capture screenshots — so UI changes can be verified visually instead of
blind-edited.

## Setup

The container is ephemeral, so install on each fresh environment:

```bash
cd tools && npm install
npx playwright install --with-deps chromium
```

(In Claude Code web sessions this is done automatically by the SessionStart hook
in `.claude/settings.json`.)

## Usage

```bash
# Screenshot the landing screen
node tools/shot.mjs /tmp/out.png

# Click through by visible text or CSS selector before shooting
node tools/shot.mjs /tmp/out.png --text "Roll a Soul" --wait 1000
node tools/shot.mjs /tmp/out.png --click "#tabbar .tab[data-tab='cultivate']"
```

The script serves the repo root statically, opens `/web/` at iPhone dimensions
(414×896 @2x), runs any `--click`/`--text` steps in order, then writes the PNG.
It prints the page title and any console/page errors so regressions surface.

```bash
# Walk the main tabs and capture a labelled screenshot set into tools/shots/
node tools/tour.mjs

# Play ~35 in-game years through the real UI — resolving event cards,
# dialogue trees and grid battles — and fail (exit 1) on any console error
node tools/smoke.mjs          # or: node tools/smoke.mjs 60
```

`smoke.mjs` complements `tests/test_web.mjs` (which is logic-only): it drives
the actual DOM, so breakage in the UI layer — a renamed element id, an overlay
that can't be dismissed, a battle screen that throws — surfaces as a failing
exit code instead of going unnoticed.
