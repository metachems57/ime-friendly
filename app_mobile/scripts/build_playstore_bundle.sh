#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ANDROID_DIR="${ROOT_DIR}/android"
APK_OUT="${ANDROID_DIR}/app/build/outputs/bundle/release/app-release.aab"

if [[ ! -f "${ANDROID_DIR}/keystore.properties" ]]; then
  echo "Missing ${ANDROID_DIR}/keystore.properties"
  echo "Copy ${ANDROID_DIR}/keystore.properties.example and fill real values."
  exit 1
fi

echo "Preparing web assets..."
"${ROOT_DIR}/app_mobile/scripts/prepare_capacitor_webdir.sh"

echo "Copying assets into Android project..."
cd "${ROOT_DIR}"
npx cap copy android

echo "Building release bundle (.aab)..."
cd "${ANDROID_DIR}"
if [[ -z "${JAVA_HOME:-}" ]]; then
  export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
fi
export PATH="${JAVA_HOME}/bin:${PATH}"
./gradlew bundleRelease

echo "Done."
echo "AAB path: ${APK_OUT}"
