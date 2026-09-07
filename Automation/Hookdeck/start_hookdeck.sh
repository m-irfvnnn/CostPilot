#!/usr/bin/env bash
# Reconnect the Hookdeck tunnel for the Pre-CRM ingestion webhook.
# Source + connection persist in the Hookdeck account (project "Event Gateway
# Starter"), so the public URL stays https://hkdk.events/3at57n99zasz2d.
# NOTE: this tunnel is session-bound — restart it after reboot / new shell.
# Requires: hookdeck CLI logged in (hookdeck ci --api-key "$HOOKDECK_API_KEY").
set -euo pipefail
cd "$(dirname "$0")/.."

if ! hookdeck whoami >/dev/null 2>&1; then
  echo "Hookdeck CLI not logged in. Run: hookdeck ci --api-key \$HOOKDECK_API_KEY"
  exit 1
fi

echo "Starting tunnel: https://hkdk.events/3at57n99zasz2d -> http://localhost:5678/webhook/hookdeck-lead-ingest"
exec hookdeck listen 5678 hookdeck-lead-ingest --path /webhook/hookdeck-lead-ingest
