const ALLOWED_ORIGINS = new Set([
  "https://inclume-chile.netlify.app",
  "https://inclume-municipalidades.netlify.app",
  "http://localhost:8888",
  "http://localhost:3000",
]);

const REPORT_TYPES: Record<string, string> = {
  "Nuevo estacionamiento": "nuevo_estacionamiento",
  "Información incorrecta": "informacion_incorrecta",
  "Acceso bloqueado": "acceso_bloqueado",
  "Señalización ausente": "senalizacion_ausente",
  "Ruta con barrera": "ruta_con_barrera",
  "Otro cambio observable": "otro_cambio_observable",
  nuevo_estacionamiento: "nuevo_estacionamiento",
  informacion_incorrecta: "informacion_incorrecta",
  acceso_bloqueado: "acceso_bloqueado",
  senalizacion_ausente: "senalizacion_ausente",
  ruta_con_barrera: "ruta_con_barrera",
  otro_cambio_observable: "otro_cambio_observable",
};

const OBJECTIVES: Record<string, string> = {
  "Catastro de estacionamientos accesibles": "catastro_estacionamientos",
  "Validación ciudadana de datos": "validacion_ciudadana",
  "Revisión de rutas y entradas accesibles": "rutas_entradas",
  "Panel territorial y exportación": "panel_exportacion",
  "Otro piloto de accesibilidad urbana": "otro_piloto",
  catastro_estacionamientos: "catastro_estacionamientos",
  validacion_ciudadana: "validacion_ciudadana",
  rutas_entradas: "rutas_entradas",
  panel_exportacion: "panel_exportacion",
  otro_piloto: "otro_piloto",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type SubmissionKind = "citizen_report" | "municipal_request";

function cors(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function optional(value: unknown, maxLength: number): string | null {
  return clean(value, maxLength) || null;
}

function coordinate(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max
    ? Math.round(number * 1_000_000) / 1_000_000
    : null;
}

async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function api(supabaseUrl: string, serviceRoleKey: string, path: string, init: RequestInit): Promise<Response> {
  return fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function consumeSlot(
  supabaseUrl: string,
  serviceRoleKey: string,
  fingerprint: string,
  kind: SubmissionKind,
): Promise<boolean> {
  const response = await api(supabaseUrl, serviceRoleKey, "/rest/v1/rpc/consume_public_submission_slot", {
    method: "POST",
    body: JSON.stringify({
      p_fingerprint: fingerprint,
      p_submission_kind: kind,
      p_daily_limit: kind === "citizen_report" ? 8 : 4,
    }),
  });
  if (!response.ok) throw new Error(`rate_limit_${response.status}`);
  return Boolean(await response.json());
}

async function insert(
  supabaseUrl: string,
  serviceRoleKey: string,
  table: "citizen_reports" | "municipal_pilot_requests",
  row: Record<string, unknown>,
): Promise<string> {
  const response = await api(supabaseUrl, serviceRoleKey, `/rest/v1/${table}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    console.error("insert_failed", table, response.status, (await response.text()).slice(0, 500));
    throw new Error(`insert_${response.status}`);
  }
  const rows = await response.json();
  const reference = rows[0]?.public_reference;
  if (typeof reference !== "string" || !reference) throw new Error("missing_public_reference");
  return reference;
}

function citizenRow(payload: Record<string, unknown>): { row?: Record<string, unknown>; errors: string[] } {
  const errors: string[] = [];
  const reportType = REPORT_TYPES[clean(payload.tipo ?? payload.report_type, 80)];
  const commune = clean(payload.comuna ?? payload.commune, 80);
  const placeName = clean(payload.lugar ?? payload.place_name, 140);
  const exactReference = clean(payload.referencia ?? payload.exact_reference, 220);
  const observation = clean(payload.observacion ?? payload.observation, 1200);
  const contactEmail = optional(payload.email ?? payload.contact_email, 180);
  const confirmed = payload.declaracion === "confirmado" || payload.good_faith_confirmed === true;
  const latitudeInput = payload.latitud ?? payload.latitude;
  const longitudeInput = payload.longitud ?? payload.longitude;
  const latitude = coordinate(latitudeInput, -58, -15);
  const longitude = coordinate(longitudeInput, -112, -64);

  if (!reportType) errors.push("Selecciona un tipo de reporte válido.");
  if (commune.length < 2) errors.push("Indica la comuna.");
  if (placeName.length < 2) errors.push("Indica el lugar o destino.");
  if (exactReference.length < 2) errors.push("Agrega una referencia exacta.");
  if (observation.length < 10) errors.push("Describe la observación con al menos 10 caracteres.");
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) errors.push("El correo no tiene un formato válido.");
  if (!confirmed) errors.push("Debes confirmar la declaración de buena fe.");
  if (latitudeInput !== null && latitudeInput !== undefined && latitudeInput !== "" && latitude === null) errors.push("La latitud no es válida para Chile.");
  if (longitudeInput !== null && longitudeInput !== undefined && longitudeInput !== "" && longitude === null) errors.push("La longitud no es válida para Chile.");

  return errors.length
    ? { errors }
    : {
      errors,
      row: {
        report_type: reportType,
        commune,
        place_name: placeName,
        exact_reference: exactReference,
        latitude,
        longitude,
        observation,
        contact_email: contactEmail,
        good_faith_confirmed: true,
      },
    };
}

function municipalRow(payload: Record<string, unknown>): { row?: Record<string, unknown>; errors: string[] } {
  const errors: string[] = [];
  const institution = clean(payload.institucion ?? payload.institution, 160);
  const territory = clean(payload.territorio ?? payload.territory, 100);
  const contactName = clean(payload.nombre ?? payload.contact_name, 120);
  const contactRole = clean(payload.cargo ?? payload.contact_role, 140);
  const institutionalEmail = clean(payload.email ?? payload.institutional_email, 180);
  const phone = optional(payload.telefono ?? payload.phone, 40);
  const objective = OBJECTIVES[clean(payload.objetivo ?? payload.objective, 100)];
  const description = clean(payload.descripcion ?? payload.problem_description, 1800);
  const consent = payload.consentimiento === "acepto" || payload.consent_confirmed === true;

  if (institution.length < 2) errors.push("Indica la institución.");
  if (territory.length < 2) errors.push("Indica la comuna o territorio.");
  if (contactName.length < 2) errors.push("Indica el nombre de contacto.");
  if (contactRole.length < 2) errors.push("Indica el cargo o unidad.");
  if (!EMAIL_PATTERN.test(institutionalEmail)) errors.push("El correo institucional no es válido.");
  if (!objective) errors.push("Selecciona un objetivo válido.");
  if (description.length < 20) errors.push("Describe el problema territorial con al menos 20 caracteres.");
  if (!consent) errors.push("Debes aceptar el uso de datos para responder la solicitud.");

  return errors.length
    ? { errors }
    : {
      errors,
      row: {
        institution,
        territory,
        contact_name: contactName,
        contact_role: contactRole,
        institutional_email: institutionalEmail,
        phone,
        objective,
        problem_description: description,
        consent_confirmed: true,
      },
    };
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return origin && ALLOWED_ORIGINS.has(origin)
      ? new Response(null, { status: 204, headers: cors(origin) })
      : new Response(null, { status: 403 });
  }
  if (request.method !== "POST") return respond(origin, 405, { ok: false, message: "Método no permitido." });
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return respond(origin, 403, { ok: false, message: "Origen no permitido." });
  if (Number(request.headers.get("content-length") || "0") > 25_000) return respond(origin, 413, { ok: false, message: "El envío es demasiado grande." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return respond(origin, 503, { ok: false, message: "Servicio temporalmente no disponible." });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return respond(origin, 400, { ok: false, message: "El contenido enviado no es válido." });
  }

  if (clean(payload.bot_field ?? payload["bot-field"], 200)) return respond(origin, 202, { ok: true, reference: "RECIBIDO" });

  const rawKind = clean(payload.kind, 40);
  const kind: SubmissionKind | null = rawKind === "citizen_report"
    ? "citizen_report"
    : rawKind === "municipal_request" ? "municipal_request" : null;
  if (!kind) return respond(origin, 400, { ok: false, message: "Tipo de envío no válido." });

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  const fingerprint = await digest(`${forwarded}|${request.headers.get("user-agent") || "unknown"}|${new Date().toISOString().slice(0, 10)}`);

  try {
    if (!await consumeSlot(supabaseUrl, serviceRoleKey, fingerprint, kind)) {
      return respond(origin, 429, { ok: false, message: "Se alcanzó el límite diario de envíos desde este dispositivo. Intenta nuevamente mañana." });
    }

    const validation = kind === "citizen_report" ? citizenRow(payload) : municipalRow(payload);
    if (validation.errors.length || !validation.row) {
      return respond(origin, 422, { ok: false, message: "Revisa el formulario.", errors: validation.errors });
    }

    const reference = await insert(
      supabaseUrl,
      serviceRoleKey,
      kind === "citizen_report" ? "citizen_reports" : "municipal_pilot_requests",
      validation.row,
    );
    return respond(origin, 201, { ok: true, reference });
  } catch (error) {
    console.error("inclume_intake_error", error instanceof Error ? error.message : String(error));
    return respond(origin, 500, { ok: false, message: "No pudimos guardar el envío. Intenta nuevamente en unos minutos." });
  }
});
