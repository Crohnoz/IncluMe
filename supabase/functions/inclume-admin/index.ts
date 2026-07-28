const ALLOWED_ORIGINS = new Set([
  "https://inclume-municipalidades.netlify.app",
  "http://localhost:8888",
  "http://localhost:3000",
]);

const CITIZEN_STATUSES = new Set(["pending", "triaged", "needs_clarification", "rejected", "archived"]);
const MUNICIPAL_STATUSES = new Set(["new", "contacted", "meeting_scheduled", "pilot_scoping", "closed", "archived"]);
const PARKING_STATUSES = new Set(["pending", "approved", "rejected", "archived"]);
const TRANSFER_SIDES = new Set(["unknown", "right", "left", "both"]);
const STEP_FREE_VALUES = new Set(["unknown", "yes", "no"]);
const CONFIDENCE_LABELS = new Set(["community_reviewed", "institutional", "field_audit"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFERENCE_PATTERN = /^(CIU|MUN)-[A-F0-9]{12}$/;

type Moderator = { id: string; label: string };

function cors(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function respond(origin: string | null, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...cors(origin),
    },
  });
}

function clean(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function serviceHeaders(serviceRoleKey: string, extra: HeadersInit = {}): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function serviceFetch(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: serviceHeaders(serviceRoleKey, init.headers || {}),
  });
}

async function authenticate(
  request: Request,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<Moderator | null> {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.{32,200})$/i);
  if (!match) return null;

  const keyHash = await sha256(match[1]);
  const params = new URLSearchParams({
    select: "id,label,expires_at",
    key_hash: `eq.${keyHash}`,
    is_active: "eq.true",
    limit: "1",
  });
  const query = await serviceFetch(supabaseUrl, serviceRoleKey, `/rest/v1/moderator_api_keys?${params.toString()}`);
  if (!query.ok) throw new Error(`moderator_lookup_${query.status}`);
  const rows = await query.json();
  if (!rows.length) return null;
  if (rows[0].expires_at && new Date(rows[0].expires_at).getTime() <= Date.now()) return null;

  const updateParams = new URLSearchParams({ id: `eq.${rows[0].id}` });
  await serviceFetch(supabaseUrl, serviceRoleKey, `/rest/v1/moderator_api_keys?${updateParams.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_used_at: new Date().toISOString() }),
  });

  return { id: rows[0].id, label: rows[0].label };
}

async function queryRows(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
): Promise<unknown[]> {
  const response = await serviceFetch(supabaseUrl, serviceRoleKey, path);
  if (!response.ok) throw new Error(`query_${response.status}`);
  return await response.json();
}

async function rpc(
  supabaseUrl: string,
  serviceRoleKey: string,
  name: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const response = await serviceFetch(supabaseUrl, serviceRoleKey, `/rest/v1/rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("admin_rpc_failed", name, response.status, detail.slice(0, 500));
    throw new Error(`rpc_${name}_${response.status}`);
  }
  return await response.json();
}

async function handleGet(
  url: URL,
  moderator: Moderator,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<unknown> {
  const resource = url.searchParams.get("resource") || "session";
  if (resource === "session") return { ok: true, moderator: { label: moderator.label } };

  if (resource === "summary") {
    const metrics = await rpc(supabaseUrl, serviceRoleKey, "public_pilot_metrics", {});
    return { ok: true, metrics };
  }

  if (resource === "citizen_queue") {
    const params = new URLSearchParams({
      select: "id,public_reference,report_type,commune,place_name,exact_reference,latitude,longitude,observation,contact_email,status,created_at,updated_at,reviewed_at,moderator_notes",
      status: "in.(pending,triaged,needs_clarification)",
      order: "created_at.asc",
      limit: "100",
    });
    return { ok: true, items: await queryRows(supabaseUrl, serviceRoleKey, `/rest/v1/citizen_reports?${params.toString()}`) };
  }

  if (resource === "municipal_queue") {
    const params = new URLSearchParams({
      select: "id,public_reference,institution,territory,contact_name,contact_role,institutional_email,phone,objective,problem_description,status,created_at,updated_at,internal_notes",
      status: "not.in.(closed,archived)",
      order: "created_at.asc",
      limit: "100",
    });
    return { ok: true, items: await queryRows(supabaseUrl, serviceRoleKey, `/rest/v1/municipal_pilot_requests?${params.toString()}`) };
  }

  if (resource === "catalog") {
    const params = new URLSearchParams({
      select: "id,name,location_reference,commune,latitude,longitude,transfer_side,step_free,confidence_label,moderation_status,is_published,created_at,updated_at",
      order: "updated_at.desc",
      limit: "200",
    });
    return { ok: true, items: await queryRows(supabaseUrl, serviceRoleKey, `/rest/v1/parking_locations?${params.toString()}`) };
  }

  if (resource === "events") {
    const params = new URLSearchParams({
      select: "id,entity_type,entity_id,public_reference,action,previous_status,new_status,notes,actor_label,created_at",
      order: "created_at.desc",
      limit: "100",
    });
    return { ok: true, items: await queryRows(supabaseUrl, serviceRoleKey, `/rest/v1/intake_moderation_events?${params.toString()}`) };
  }

  throw new Error("invalid_resource");
}

async function handlePost(
  request: Request,
  moderator: Moderator,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<unknown> {
  if (Number(request.headers.get("content-length") || "0") > 20_000) throw new Error("payload_too_large");
  const payload = await request.json();
  const action = clean(payload.action, 80);
  const notes = clean(payload.notes, 2000) || null;

  if (action === "citizen_status") {
    const reference = clean(payload.reference, 20).toUpperCase();
    const status = clean(payload.status, 40);
    if (!REFERENCE_PATTERN.test(reference) || !reference.startsWith("CIU-") || !CITIZEN_STATUSES.has(status)) throw new Error("invalid_citizen_action");
    const id = await rpc(supabaseUrl, serviceRoleKey, "moderate_citizen_report", {
      p_public_reference: reference,
      p_new_status: status,
      p_notes: notes,
      p_actor_label: moderator.label,
    });
    return { ok: true, id };
  }

  if (action === "municipal_status") {
    const reference = clean(payload.reference, 20).toUpperCase();
    const status = clean(payload.status, 40);
    if (!REFERENCE_PATTERN.test(reference) || !reference.startsWith("MUN-") || !MUNICIPAL_STATUSES.has(status)) throw new Error("invalid_municipal_action");
    const id = await rpc(supabaseUrl, serviceRoleKey, "moderate_municipal_request", {
      p_public_reference: reference,
      p_new_status: status,
      p_notes: notes,
      p_actor_label: moderator.label,
    });
    return { ok: true, id };
  }

  if (action === "publish_report") {
    const reference = clean(payload.reference, 20).toUpperCase();
    const transferSide = clean(payload.transferSide, 20);
    const stepFree = clean(payload.stepFree, 20);
    const confidenceLabel = clean(payload.confidenceLabel, 40);
    if (!REFERENCE_PATTERN.test(reference) || !reference.startsWith("CIU-")) throw new Error("invalid_reference");
    if (!TRANSFER_SIDES.has(transferSide) || !STEP_FREE_VALUES.has(stepFree) || !CONFIDENCE_LABELS.has(confidenceLabel)) throw new Error("invalid_publication_fields");
    const id = await rpc(supabaseUrl, serviceRoleKey, "promote_citizen_report_to_parking", {
      p_public_reference: reference,
      p_transfer_side: transferSide,
      p_step_free: stepFree,
      p_confidence_label: confidenceLabel,
      p_moderator_notes: notes,
      p_actor_label: moderator.label,
    });
    return { ok: true, id };
  }

  if (action === "parking_status") {
    const parkingId = clean(payload.parkingId, 40);
    const status = clean(payload.status, 40);
    const isPublished = payload.isPublished === true;
    if (!UUID_PATTERN.test(parkingId) || !PARKING_STATUSES.has(status)) throw new Error("invalid_parking_action");
    if (status !== "approved" && isPublished) throw new Error("invalid_publication_state");
    const id = await rpc(supabaseUrl, serviceRoleKey, "moderate_parking_location", {
      p_parking_id: parkingId,
      p_moderation_status: status,
      p_is_published: isPublished,
      p_notes: notes,
      p_actor_label: moderator.label,
    });
    return { ok: true, id };
  }

  throw new Error("invalid_action");
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    return origin && ALLOWED_ORIGINS.has(origin)
      ? new Response(null, { status: 204, headers: cors(origin) })
      : new Response(null, { status: 403 });
  }
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return respond(origin, 403, { ok: false, message: "Origen no permitido." });
  if (request.method !== "GET" && request.method !== "POST") return respond(origin, 405, { ok: false, message: "Método no permitido." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return respond(origin, 503, { ok: false, message: "Servicio temporalmente no disponible." });

  try {
    const moderator = await authenticate(request, supabaseUrl, serviceRoleKey);
    if (!moderator) return respond(origin, 401, { ok: false, message: "Clave administrativa no válida." });

    const result = request.method === "GET"
      ? await handleGet(new URL(request.url), moderator, supabaseUrl, serviceRoleKey)
      : await handlePost(request, moderator, supabaseUrl, serviceRoleKey);
    return respond(origin, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("inclume_admin_error", message);
    if (message.startsWith("invalid_")) return respond(origin, 422, { ok: false, message: "La acción o sus datos no son válidos." });
    if (message === "payload_too_large") return respond(origin, 413, { ok: false, message: "La solicitud es demasiado grande." });
    return respond(origin, 500, { ok: false, message: "No fue posible completar la operación administrativa." });
  }
});
