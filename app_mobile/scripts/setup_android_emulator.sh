#!/usr/bin/env bash
set -euo pipefail

echo "[1/7] Detection des outils Android..."

find_bin() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
    return 0
  fi
  return 1
}

SDKMANAGER_BIN=""
AVDMANAGER_BIN=""
EMULATOR_BIN=""
ADB_BIN=""
BOOTSTRAP_CMDLINE_TOOLS="false"

if [[ -z "${SDKMANAGER_BIN}" ]]; then
  SDKMANAGER_BIN="$(find_bin sdkmanager || true)"
fi
if [[ -z "${AVDMANAGER_BIN}" ]]; then
  AVDMANAGER_BIN="$(find_bin avdmanager || true)"
fi
if [[ -z "${EMULATOR_BIN}" ]]; then
  EMULATOR_BIN="$(find_bin emulator || true)"
fi
if [[ -z "${ADB_BIN}" ]]; then
  ADB_BIN="$(find_bin adb || true)"
fi

for p in \
  /usr/lib/android-sdk/cmdline-tools/latest/bin \
  /usr/lib/android-sdk/tools/bin \
  /opt/android-sdk/cmdline-tools/latest/bin \
  /opt/android-sdk/tools/bin
do
  if [[ -z "${SDKMANAGER_BIN}" && -x "${p}/sdkmanager" ]]; then
    SDKMANAGER_BIN="${p}/sdkmanager"
  fi
  if [[ -z "${AVDMANAGER_BIN}" && -x "${p}/avdmanager" ]]; then
    AVDMANAGER_BIN="${p}/avdmanager"
  fi
done

for p in \
  /usr/lib/android-sdk/emulator \
  /opt/android-sdk/emulator
do
  if [[ -z "${EMULATOR_BIN}" && -x "${p}/emulator" ]]; then
    EMULATOR_BIN="${p}/emulator"
  fi
done

if [[ -z "${ADB_BIN}" ]]; then
  ADB_BIN="$(find_bin adb || true)"
fi

# Old Debian/Kali tools path is often Java-incompatible with modern JDK.
if [[ "${SDKMANAGER_BIN}" == *"/android-sdk/tools/bin/sdkmanager" ]]; then
  BOOTSTRAP_CMDLINE_TOOLS="true"
fi

if [[ -z "${SDKMANAGER_BIN}" || -z "${AVDMANAGER_BIN}" ]]; then
  BOOTSTRAP_CMDLINE_TOOLS="true"
fi

if [[ "${BOOTSTRAP_CMDLINE_TOOLS}" == "true" ]]; then
  echo "[2/7] Installation des cmdline-tools Google recents (utilisateur)..."
  ANDROID_SDK_ROOT="${HOME}/Android/Sdk"
  TOOLS_ZIP="/tmp/commandlinetools-linux-latest.zip"
  TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip"
  mkdir -p "${ANDROID_SDK_ROOT}/cmdline-tools"
  curl -fL "${TOOLS_URL}" -o "${TOOLS_ZIP}"
  rm -rf "${ANDROID_SDK_ROOT}/cmdline-tools/latest"
  mkdir -p "${ANDROID_SDK_ROOT}/cmdline-tools/latest"
  rm -rf /tmp/cmdline-tools-unpacked
  unzip -q "${TOOLS_ZIP}" -d /tmp/cmdline-tools-unpacked
  rm -rf "${ANDROID_SDK_ROOT}/cmdline-tools/latest"
  mkdir -p "${ANDROID_SDK_ROOT}/cmdline-tools/latest"
  cp -r /tmp/cmdline-tools-unpacked/cmdline-tools/* "${ANDROID_SDK_ROOT}/cmdline-tools/latest/"
  rm -rf /tmp/cmdline-tools-unpacked
  SDKMANAGER_BIN="${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager"
  AVDMANAGER_BIN="${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin/avdmanager"
  EMULATOR_BIN="${ANDROID_SDK_ROOT}/emulator/emulator"
  if [[ -z "${ADB_BIN}" ]]; then
    ADB_BIN="$(find_bin adb || true)"
  fi
else
  echo "[2/7] Outils SDK detectes localement."
  ANDROID_SDK_ROOT="$(cd "$(dirname "$(dirname "${SDKMANAGER_BIN}")")" && pwd)"
fi

if [[ -z "${ADB_BIN}" ]]; then
  ADB_BIN="${ANDROID_SDK_ROOT}/platform-tools/adb"
fi

if [[ -z "${SDKMANAGER_BIN}" || -z "${AVDMANAGER_BIN}" ]]; then
  echo "ERREUR: sdkmanager/avdmanager introuvables."
  exit 1
fi

export ANDROID_SDK_ROOT
export ANDROID_HOME="${ANDROID_SDK_ROOT}"
export ANDROID_AVD_HOME="${HOME}/.config/.android/avd"
mkdir -p "${ANDROID_AVD_HOME}"

echo "[3/7] SDK root: ${ANDROID_SDK_ROOT}"
echo "[4/7] Acceptation des licences..."
yes | "${SDKMANAGER_BIN}" --licenses >/dev/null || true

echo "[5/7] Installation des composants..."
"${SDKMANAGER_BIN}" \
  "platform-tools" \
  "platforms;android-34" \
  "build-tools;34.0.0" \
  "emulator" \
  "system-images;android-34;google_apis;x86_64"

echo "[6/7] Creation de l'AVD imeFriendlyApi34..."
AVD_NAME="imeFriendlyApi34"
if "${EMULATOR_BIN}" -list-avds | grep -qx "${AVD_NAME}"; then
  echo "AVD ${AVD_NAME} existe deja."
else
  echo "no" | "${AVDMANAGER_BIN}" create avd \
    --name "${AVD_NAME}" \
    --package "system-images;android-34;google_apis;x86_64" \
    --device "pixel_6"
fi

echo "[7/7] Demarrage de l'emulateur..."
"${EMULATOR_BIN}" -avd "${AVD_NAME}" -netdelay none -netspeed full >/tmp/ime_emulator.log 2>&1 &
sleep 3
if [[ -x "${ADB_BIN}" ]]; then
  "${ADB_BIN}" wait-for-device
  "${ADB_BIN}" devices
else
  adb wait-for-device
  adb devices
fi

echo
echo "OK: emulateur lance."
echo "Pour installer un APK:"
echo "adb install -r /chemin/vers/app-debug.apk"
