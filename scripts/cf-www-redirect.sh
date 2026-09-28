#!/usr/bin/env bash
#
# Creates a zone-level Single Redirect Rule on Cloudflare that 301-redirects
# www.yevilla.com -> https://yevilla.com (preserving path + query string).
#
# Cloudflare Pages `_redirects` cannot do hostname redirects (it only matches
# on path), so this must live as a zone Dynamic Redirect ruleset rule.
#
# Usage:
#   CLOUDFLARE_API_TOKEN=<token> bash scripts/cf-www-redirect.sh
#
# The token needs: Zone -> Dynamic Redirect (Edit) and Zone -> Zone (Read),
# scoped to the yevilla.com zone. Create at:
#   https://dash.cloudflare.com/profile/api-tokens  (Create Token -> Custom)
#
# Idempotent: re-running detects the existing rule and does nothing.

set -euo pipefail

ZONE_NAME="yevilla.com"
APEX="https://yevilla.com"
WWW_HOST="www.yevilla.com"
API="https://api.cloudflare.com/client/v4"

: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN (Zone:Read + Dynamic Redirect:Edit)}"
command -v jq >/dev/null || { echo "jq is required (brew install jq)"; exit 1; }

auth=(-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "Content-Type: application/json")

api() { # method path [data]
  local method="$1" path="$2" data="${3:-}"
  if [[ -n "$data" ]]; then
    curl -sS -X "$method" "${auth[@]}" --data "$data" "${API}${path}"
  else
    curl -sS -X "$method" "${auth[@]}" "${API}${path}"
  fi
}

check() { # json -> exit if not success
  if [[ "$(jq -r '.success' <<<"$1")" != "true" ]]; then
    echo "Cloudflare API error:" >&2
    jq -r '.errors' <<<"$1" >&2
    exit 1
  fi
}

echo "→ Resolving zone id for ${ZONE_NAME}..."
zres="$(api GET "/zones?name=${ZONE_NAME}")"
check "$zres"
ZONE_ID="$(jq -r '.result[0].id // empty' <<<"$zres")"
[[ -n "$ZONE_ID" ]] || { echo "Zone ${ZONE_NAME} not found for this token."; exit 1; }
echo "  zone id: ${ZONE_ID}"

echo "→ Fetching dynamic-redirect ruleset..."
eres="$(api GET "/zones/${ZONE_ID}/rulesets/phases/http_request_dynamic_redirect/entrypoint")"
# A 404 here just means the phase has no ruleset yet; treat as empty.
if [[ "$(jq -r '.success' <<<"$eres")" == "true" ]]; then
  existing_rules="$(jq -c '.result.rules // []' <<<"$eres")"
else
  existing_rules="[]"
fi

if jq -e --arg h "$WWW_HOST" '.[]?.expression | test($h)' <<<"$existing_rules" >/dev/null; then
  echo "✓ A redirect rule referencing ${WWW_HOST} already exists. Nothing to do."
  exit 0
fi

new_rule="$(jq -n --arg apex "$APEX" --arg host "$WWW_HOST" '{
  action: "redirect",
  action_parameters: {
    from_value: {
      status_code: 301,
      target_url: { expression: ("concat(\"" + $apex + "\", http.request.uri.path)") },
      preserve_query_string: true
    }
  },
  expression: ("(http.host eq \"" + $host + "\")"),
  description: "Redirect www to apex (301)"
}')"

body="$(jq -n --argjson rules "$existing_rules" --argjson rule "$new_rule" '{
  name: "default",
  rules: ($rules + [$rule])
}')"

echo "→ Creating www -> apex 301 redirect rule..."
pres="$(api PUT "/zones/${ZONE_ID}/rulesets/phases/http_request_dynamic_redirect/entrypoint" "$body")"
check "$pres"
echo "✓ Rule created."

echo "→ Verifying live behavior..."
sleep 2
code="$(curl -sI -o /dev/null -w '%{http_code}' "https://${WWW_HOST}/" || true)"
loc="$(curl -sI "https://${WWW_HOST}/" | awk 'tolower($1)=="location:"{print $2}' | tr -d '\r' || true)"
echo "  https://${WWW_HOST}/ -> HTTP ${code} ${loc:+(Location: ${loc})}"
if [[ "$code" == "301" ]]; then
  echo "✓ Done. www now 301-redirects to the apex domain."
else
  echo "  (Edge may take a moment to propagate; re-check in ~30s.)"
fi
