#!/usr/bin/env bash
# Upload knowledge-base docs to the R2 bucket that backs the AI Search instance.
# Usage: ./scripts/upload-docs.sh
set -euo pipefail
BUCKET="cf-free-ai-pi-docs"
cd "$(dirname "$0")/.."

npx wrangler r2 bucket create "$BUCKET" 2>/dev/null || true

for f in public/docs/*; do
  name="$(basename "$f")"
  echo "→ uploading $name"
  npx wrangler r2 object put "$BUCKET/$name" --file "$f" --remote --content-type "text/markdown"
done

echo "Done. Now POST /api/setup (creates/refreshes the AI Search instance over this bucket)."
