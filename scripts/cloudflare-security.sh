#!/usr/bin/env bash
# Configures Cloudflare security settings for yevilla.com via the Cloudflare API.
#
# Prerequisites:
#   1. Create an API token at https://dash.cloudflare.com/profile/api-tokens
#      Permissions required: Zone > Zone Settings > Edit, Zone > WAF > Edit, Zone > Bot Management > Edit
#   2. Find your Zone ID: Cloudflare Dashboard > yevilla.com > Overview > (right sidebar)
#
# Usage:
#   CF_TOKEN=your_api_token ZONE_ID=your_zone_id bash scripts/cloudflare-security.sh

set -euo pipefail

: "${CF_TOKEN:?Set CF_TOKEN to your Cloudflare API token}"
: "${ZONE_ID:?Set ZONE_ID to your yevilla.com zone ID}"

BASE="https://api.cloudflare.com/client/v4/zones/$ZONE_ID"
AUTH=(-H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json")

ok() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; echo "$2" | python3 -m json.tool 2>/dev/null || echo "$2"; }

run() {
  local label=$1; shift
  local resp
  resp=$(curl -s "$@")
  if echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('success') else 1)" 2>/dev/null; then
    ok "$label"
  else
    fail "$label" "$resp"
  fi
}

echo ""
echo "=== Zone Settings ==="

run "Security level → medium" \
  -X PATCH "$BASE/settings/security_level" "${AUTH[@]}" \
  --data '{"value":"medium"}'

run "Browser Integrity Check → on" \
  -X PATCH "$BASE/settings/browser_check" "${AUTH[@]}" \
  --data '{"value":"on"}'

run "Hotlink Protection → on" \
  -X PATCH "$BASE/settings/hotlink_protection" "${AUTH[@]}" \
  --data '{"value":"on"}'

run "Email Obfuscation → on" \
  -X PATCH "$BASE/settings/email_obfuscation" "${AUTH[@]}" \
  --data '{"value":"on"}'

run "Automatic HTTPS Rewrites → on" \
  -X PATCH "$BASE/settings/automatic_https_rewrites" "${AUTH[@]}" \
  --data '{"value":"on"}'

run "TLS 1.3 → on" \
  -X PATCH "$BASE/settings/tls_1_3" "${AUTH[@]}" \
  --data '{"value":"on"}'

run "Opportunistic Encryption → on" \
  -X PATCH "$BASE/settings/opportunistic_encryption" "${AUTH[@]}" \
  --data '{"value":"on"}'

echo ""
echo "=== Bot Fight Mode (Free tier) ==="
# fight_mode = true enables free Bot Fight Mode.
# Requires Pro plan: replace with {"sb_challenge":true} for Super Bot Fight Mode.
run "Bot Fight Mode → on" \
  -X PUT "$BASE/bot_management" "${AUTH[@]}" \
  --data '{"fight_mode":true}'

echo ""
echo "=== WAF Managed Rules ==="
# Deploys Cloudflare Managed Ruleset + OWASP Core Ruleset to the http_request_firewall_managed phase.
# These ruleset IDs are Cloudflare's well-known global IDs (same for every account).
run "Cloudflare Managed Ruleset + OWASP" \
  -X PUT "$BASE/rulesets/phases/http_request_firewall_managed/entrypoint" "${AUTH[@]}" \
  --data '{
    "rules": [
      {
        "action": "execute",
        "expression": "true",
        "action_parameters": {"id": "efb7b8c949ac4650a09736fc376e9aee"},
        "description": "Cloudflare Managed Ruleset"
      },
      {
        "action": "execute",
        "expression": "true",
        "action_parameters": {"id": "4814384a9e5d4991b9815dcfc25d2f1f"},
        "description": "Cloudflare OWASP Core Ruleset"
      }
    ]
  }'

echo ""
echo "=== Edge Rate Limiting (Worker API) ==="
# These limits sit in front of the Worker's own KV rate limits, blocking at the Cloudflare edge.
# Protects against bursts before requests even reach the Worker.
run "Rate limit: POST /listing and /upload (10 req/min per IP → block 5 min)" \
  -X PUT "$BASE/rulesets/phases/http_ratelimit/entrypoint" "${AUTH[@]}" \
  --data '{
    "rules": [
      {
        "action": "block",
        "ratelimit": {
          "characteristics": ["ip.src"],
          "period": 60,
          "requests_per_period": 10,
          "mitigation_timeout": 300
        },
        "expression": "(http.request.method eq \"POST\") and (http.host contains \"workers.dev\") and (not http.request.uri.path contains \"/admin\")",
        "description": "Block POST floods to Worker (non-admin)"
      },
      {
        "action": "block",
        "ratelimit": {
          "characteristics": ["ip.src"],
          "period": 60,
          "requests_per_period": 100,
          "mitigation_timeout": 60
        },
        "expression": "(http.request.method eq \"GET\") and (http.host contains \"workers.dev\")",
        "description": "Block GET floods to Worker"
      }
    ]
  }'

echo ""
echo "Done. Check the Cloudflare dashboard to verify WAF and Bot Management are active."
echo ""
echo "Manual steps still required in the dashboard:"
echo "  • Security > Events — confirm WAF is firing on real traffic"
echo "  • Security > Bots  — review bot score thresholds if needed"
echo "  • If on Pro plan: switch Bot Fight Mode to Super Bot Fight Mode"
