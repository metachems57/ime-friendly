#!/usr/bin/env bash
set -euo pipefail

SERVICE_ACCOUNT_FILE="${1:-}"
PROJECT_URL="${SUPABASE_PROJECT_URL:-https://eecejwuqsmgavtitbjou.supabase.co}"

if [[ -z "${SERVICE_ACCOUNT_FILE}" || ! -f "${SERVICE_ACCOUNT_FILE}" ]]; then
  echo "Usage: $0 /chemin/vers/firebase-service-account.json"
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl est requis pour generer le secret webhook."
  exit 1
fi

WEBHOOK_SECRET="${PUSH_WEBHOOK_SECRET:-$(openssl rand -hex 32)}"
FIREBASE_SERVICE_ACCOUNT_JSON="$(tr -d '\n' < "${SERVICE_ACCOUNT_FILE}")"
ESCAPED_WEBHOOK_SECRET="${WEBHOOK_SECRET//\'/\'\'}"
ESCAPED_PROJECT_URL="${PROJECT_URL//\'/\'\'}"
PUSH_FUNCTION_URL="${PROJECT_URL}/functions/v1/send-push"
ESCAPED_PUSH_FUNCTION_URL="${PUSH_FUNCTION_URL//\'/\'\'}"

npx supabase secrets set \
  "FIREBASE_SERVICE_ACCOUNT_JSON=${FIREBASE_SERVICE_ACCOUNT_JSON}" \
  "PUSH_WEBHOOK_SECRET=${WEBHOOK_SECRET}"

npx supabase db query --linked "
insert into public.app_private_settings (key, value, updated_at)
values
  ('push_webhook_secret', '${ESCAPED_WEBHOOK_SECRET}', now()),
  ('push_webhook_url', '${ESCAPED_PUSH_FUNCTION_URL}', now())
on conflict (key) do update
set value = excluded.value,
    updated_at = now();
"

echo "Notifications push activees cote Supabase."
echo "Secret webhook configure."
