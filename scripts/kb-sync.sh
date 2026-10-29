#!/usr/bin/env bash
# Sync knowledge-base docs (public/docs/*.md) into the AI Search instance
# via the Items REST API, using wrangler's local OAuth token (no API token,
# no card needed). Requires the instance to exist: POST /api/setup first.
#
# Usage: ./scripts/kb-sync.sh
set -euo pipefail
cd "$(dirname "$0")/.."

ACC="${CLOUDFLARE_ACCOUNT_ID:-$(npx wrangler whoami 2>/dev/null | grep -oE '[a-f0-9]{32}' | head -1)}"
if [ -z "$ACC" ]; then echo "cannot determine account id"; exit 1; fi

CFG="$HOME/Library/Preferences/.wrangler/config/default.toml"
[ -f "$CFG" ] || CFG="$HOME/.wrangler/config/default.toml"
# any wrangler command refreshes the OAuth token if it expired
npx wrangler whoami >/dev/null 2>&1 || true
TOKEN=$(grep -E '^oauth_token' "$CFG" | cut -d'"' -f2)
INSTANCE="${KB_INSTANCE:-cf-free-ai-pi-kb}"
BASE="https://api.cloudflare.com/client/v4/accounts/$ACC/ai-search/namespaces/default/instances/$INSTANCE/items"

for f in public/docs/*; do
  name="$(basename "$f")"
  echo "→ upload $name"
  curl -s -X POST "$BASE" -H "Authorization: Bearer $TOKEN" -F "file=@$f" \
    | python3 -I -c "import json,sys; d=json.load(sys.stdin); print('  ', 'ok' if d.get('success') else d.get('errors'))"
done

echo "Uploaded. Indexing takes a minute or two — poll: curl .../api/status"
