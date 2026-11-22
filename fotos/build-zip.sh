#!/usr/bin/env bash
# Genera tmunot-cloudflare.zip listo para subir por el panel de Cloudflare Pages.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf dist && mkdir dist && cp -r public/. dist/
npx esbuild worker-entry.js --bundle --format=esm --minify --outfile=dist/_worker.js --log-level=warning
printf '{"version":1,"include":["/api/*"],"exclude":[]}\n' > dist/_routes.json
rm -f tmunot-cloudflare.zip
(cd dist && zip -qr ../tmunot-cloudflare.zip .)
echo "Listo: $(pwd)/tmunot-cloudflare.zip"
