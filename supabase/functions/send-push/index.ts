type PushEvent = {
  event?: string;
  recipient_id?: string;
  actor_id?: string;
  source?: string;
  source_post_id?: number | string;
  post_title?: string;
  message?: string;
  type?: string;
  content?: string;
  table?: string;
  record?: Record<string, unknown>;
};

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

type PushTokenRow = {
  id: number;
  user_id: string;
  token: string;
  platform: string;
};

let cachedAccessToken = "";
let cachedAccessTokenExpiresAt = 0;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-webhook-secret",
};

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function cleanText(value: unknown, fallback = ""): string {
  return String(value ?? fallback).trim();
}

function getEnv(name: string): string {
  return Deno.env.get(name)?.trim() || "";
}

function parseServiceAccount(): ServiceAccount {
  const rawValue = getEnv("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!rawValue) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON secret");
  }

  const decoded = rawValue.startsWith("{")
    ? rawValue
    : new TextDecoder().decode(Uint8Array.from(atob(rawValue), (char) => char.charCodeAt(0)));
  const parsed = JSON.parse(decoded) as Partial<ServiceAccount>;

  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error("Invalid Firebase service account JSON");
  }

  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key,
    project_id: parsed.project_id,
  };
}

function base64UrlEncode(input: string | ArrayBuffer): string {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = Uint8Array.from(atob(pemBody), (char) => char.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function getFirebaseAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessTokenExpiresAt - 60 > now) {
    return cachedAccessToken;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsignedJwt = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`;
  const key = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(unsignedJwt),
  );
  const assertion = `${unsignedJwt}.${base64UrlEncode(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Firebase OAuth failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  cachedAccessToken = cleanText(data.access_token);
  cachedAccessTokenExpiresAt = now + Number(data.expires_in || 3600);
  if (!cachedAccessToken) {
    throw new Error("Firebase OAuth returned no access token");
  }
  return cachedAccessToken;
}

function buildLink(source: string, postId: number, title: string): string {
  const safeTitle = encodeURIComponent(title.slice(0, 120));
  if (source === "reseau" && postId > 0) {
    return `reseau.html?highlightPost=${postId}&highlightTitle=${safeTitle}#post-${postId}`;
  }
  if (source === "blog" && postId > 0) {
    return `blog.html?highlightPost=${postId}&highlightTitle=${safeTitle}#post-${postId}`;
  }
  if (source === "tools" && postId > 0) {
    return `detail-outil.html?id=${postId}`;
  }
  if (source === "messagerie") return "messagerie.html";
  return "index.html";
}

function buildPushContent(event: PushEvent) {
  const source = cleanText(event.source || event.record?.source).toLowerCase();
  const postId = Number(event.source_post_id || event.record?.source_post_id || event.record?.id || 0);
  const postTitle = cleanText(event.post_title || event.record?.post_title || event.record?.title || event.record?.name, "Publication");
  const eventName = cleanText(event.event || event.table, "notification").toLowerCase();
  const message = cleanText(event.message || event.record?.message || event.content || event.record?.content);
  const type = cleanText(event.type || event.record?.type, "system").toLowerCase();

  if (eventName === "private_message") {
    return {
      title: "Nouveau message",
      body: message ? `Message: ${message.slice(0, 90)}` : "Vous avez recu un nouveau message.",
      source: "messagerie",
      type: "message",
      postId: 0,
      postTitle: "Messagerie",
      link: "messagerie.html",
    };
  }

  if (eventName === "new_post") {
    const label = source === "blog" ? "Blog" : source === "tools" ? "Outils" : "Réseau";
    return {
      title: `Nouveau post ${label}`,
      body: postTitle,
      source,
      type: "new_post",
      postId,
      postTitle,
      link: buildLink(source, postId, postTitle),
    };
  }

  return {
    title: "Nouvelle notification",
    body: message || postTitle,
    source,
    type,
    postId,
    postTitle,
    link: buildLink(source, postId, postTitle),
  };
}

async function supabaseRequest(path: string, options: RequestInit = {}) {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase REST failed: ${response.status} ${await response.text()}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function getTokens(event: PushEvent): Promise<PushTokenRow[]> {
  const eventName = cleanText(event.event || event.table).toLowerCase();
  const actorId = cleanText(event.actor_id || event.record?.actor_id || event.record?.author_id || event.record?.from_user_id);
  const recipientId = cleanText(event.recipient_id || event.record?.recipient_id || event.record?.to_user_id);

  if (eventName === "new_post") {
    const query = [
      "select=id,user_id,token,platform",
      "enabled=eq.true",
      actorId ? `user_id=neq.${encodeURIComponent(actorId)}` : "",
    ].filter(Boolean).join("&");
    return await supabaseRequest(`user_push_tokens?${query}`) as PushTokenRow[];
  }

  if (!recipientId) return [];

  const query = [
    "select=id,user_id,token,platform",
    "enabled=eq.true",
    `user_id=eq.${encodeURIComponent(recipientId)}`,
  ].join("&");
  return await supabaseRequest(`user_push_tokens?${query}`) as PushTokenRow[];
}

async function disableToken(tokenId: number) {
  await supabaseRequest(`user_push_tokens?id=eq.${encodeURIComponent(String(tokenId))}`, {
    method: "PATCH",
    body: JSON.stringify({
      enabled: false,
      updated_at: new Date().toISOString(),
    }),
  });
}

function stringifyData(data: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, cleanText(value)]));
}

async function sendToToken(
  tokenRow: PushTokenRow,
  accessToken: string,
  projectId: string,
  content: ReturnType<typeof buildPushContent>,
) {
  const payload = {
    message: {
      token: tokenRow.token,
      notification: {
        title: content.title,
        body: content.body,
      },
      data: stringifyData({
        source: content.source,
        type: content.type,
        postId: content.postId,
        source_post_id: content.postId,
        post_title: content.postTitle,
        title: content.postTitle,
        body: content.body,
        link: content.link,
      }),
      android: {
        priority: "HIGH",
        notification: {
          click_action: "OPEN_APP",
        },
      },
    },
  };

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) return { ok: true };

  const errorText = await response.text();
  if (
    response.status === 404 ||
    errorText.includes("UNREGISTERED") ||
    errorText.includes("INVALID_ARGUMENT")
  ) {
    await disableToken(tokenRow.id).catch(() => {});
  }

  return { ok: false, status: response.status, error: errorText };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const expectedSecret = getEnv("PUSH_WEBHOOK_SECRET");
  const receivedSecret = request.headers.get("x-push-webhook-secret")?.trim() || "";
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  try {
    const event = await request.json() as PushEvent;
    const tokens = await getTokens(event);
    if (!tokens.length) {
      return jsonResponse({ ok: true, sent: 0, reason: "no_tokens" });
    }

    const serviceAccount = parseServiceAccount();
    const accessToken = await getFirebaseAccessToken(serviceAccount);
    const content = buildPushContent(event);
    const uniqueTokens = Array.from(new Map(tokens.map((row) => [row.token, row])).values());
    const results = await Promise.all(uniqueTokens.map((row) => (
      sendToToken(row, accessToken, serviceAccount.project_id, content)
    )));

    return jsonResponse({
      ok: true,
      sent: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
