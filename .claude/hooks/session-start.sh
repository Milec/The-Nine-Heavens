#!/bin/bash
# SessionStart hook: restore the headless-browser tooling used to verify the
# web UI. The container is ephemeral, so Chromium and tools/node_modules must be
# reinstalled each fresh session. Idempotent and non-interactive.
set -euo pipefail

# Only needed in Claude Code on the web (the ephemeral remote container).
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR/tools"

# Node deps for the screenshot helper (cached after first run).
npm install --no-audit --no-fund

# Headless Chromium + system libraries for Playwright.
npx playwright install --with-deps chromium
