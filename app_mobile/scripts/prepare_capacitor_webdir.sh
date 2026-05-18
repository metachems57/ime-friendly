#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WWW_DIR="${ROOT_DIR}/www"

echo "Preparing Capacitor webDir at: ${WWW_DIR}"
rm -rf "${WWW_DIR}"
mkdir -p "${WWW_DIR}"

rsync -a \
  --exclude '.git/' \
  --exclude '.vscode/' \
  --exclude 'node_modules/' \
  --exclude 'android/' \
  --exclude 'supabase/' \
  --exclude 'app_mobile/' \
  --exclude 'www/' \
  --exclude 'tokens.txt' \
  --exclude '*.log' \
  "${ROOT_DIR}/" "${WWW_DIR}/"

PUSH_CONFIG_FILE="${ROOT_DIR}/android/app/google-services.json"
RUNTIME_CONFIG_FILE="${WWW_DIR}/app-runtime-config.json"

if [[ -f "${PUSH_CONFIG_FILE}" ]]; then
  cat > "${RUNTIME_CONFIG_FILE}" <<'EOF'
{
  "nativePushCapable": true,
  "reason": "google-services.json_present"
}
EOF
else
  cat > "${RUNTIME_CONFIG_FILE}" <<'EOF'
{
  "nativePushCapable": false,
  "reason": "google-services.json_missing"
}
EOF
fi

echo "Done. Files copied to www/."
