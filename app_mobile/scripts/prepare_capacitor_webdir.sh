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

echo "Done. Files copied to www/."
