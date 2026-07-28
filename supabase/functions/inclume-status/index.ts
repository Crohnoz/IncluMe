const ALLOWED_ORIGINS = new Set([
  "https://inclume-chile.netlify.app",
  "https://inclume-municipalidades.netlify.app",
  "http://localhost:8888",
  "http://localhost:3000",
]);

const CITIZEN_STATUS: Record<string, { label: string; description: string }> = {
  pending: { label: "Recibido", description: "El reporte está guardado y pendiente de revisión inicial." },
  triaged: { label: "En revisión", description: "El equipo está clasificando y comprobando la información observable." },
  accepted: { label: "Aprobado", description: "El reporte fue aceptado. La publicación puede requerir completar o verificar datos adicionales." },
  needs_clarification: { label: "Requiere aclaración", description: "El equipo necesita información adicional antes de resolver el reporte." },
  rejected: { label: "No incorporado", description: "El reporte no fue incorporado al catálogo en esta revisión." },
  archived: { label: "Archivado", description: "El reporte fue cerrado o reemplazado por información más reciente." },
};

const MUNICIPAL_STATUS: Record<string, { label: string; description: string }> = {
  new: { label: "Recibida", description: "La solicitud institucional está guardada y pendiente de revisión." },
  contacted: { label: "Contacto iniciado", description: "IncluMe inició la coordinación con la institución." },
  meeting_scheduled: { label: "Reunión coordinada", description: "Existe una conversación institucional programada." },
  pilot_scoping: { label: "Definiendo piloto", description: "Se está delimitando territorio, datos, responsabilidades y criterios del piloto." },
  closed: { label: "Cerrada", description: "La solicitud fue resuelta o finalizó su etapa de evaluación." },
  archived: { label: "Archivada", description: "La solicitud quedó archivada para referencia institucional." },
};

function headers(origin: string | null): Record<string, string> {
  const values: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) values["Access-Control-Allow-Origin"] = origin;
  return values;
}

function response(origin: string | null, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    return origin && ALLOWED_ORIGINS.has(origin)
      ? new Response(null, { status: 204, headers: headers(origin) })
      : new Response(null, { status: 403 });
  }
  if (request.method !== "GET") return response(origin, 405, { ok: false, message: "Método no permitido." });
  if (origin && !ALLOWED_ORIGINS.has(origin)) return response(origin, 403, { ok: false, message: "Origen no permitido." });

  const reference = new URL(request.url).searchParams.get("ref")?.trim().toUpperCase() || "";
  if (!/^(CIU|MUN)-[A-F0-9]{12}$/.test(reference)) {
    return response(origin, 400, { ok: false, message: "La referencia no tiene un formato válido." });
  }

  const isCitizen = reference.startsWith("CIU-");
  const table = isCitizen ? "citizen_reports" : "municipal_pilot_requests";
  const fields = isCitizen
    ? "public_reference,status,created_at,updated_at,reviewed_at"
    : "public_reference,status,created_at,updated_at";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return response(origin, 503, { ok: false, message: "Servicio temporalmente no disponible." });

  const params = new URLSearchParams({
    select: fields,
    public_reference: `eq.${reference}`,
    limit: "1",
  });

  try {
    const query = await fetch(`${supabaseUrl}/rest/v1/${table}?${params.toString()}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    if (!query.ok) throw new Error(`status_${query.status}`);
    const rows = await query.json();
    if (!rows.length) return response(origin, 404, { ok: false, message: "No encontramos un envío con esa referencia." });

    const row = rows[0];
    const publicStatus = (isCitizen ? CITIZEN_STATUS : MUNICIPAL_STATUS)[row.status]
      || { label: "En proceso", description: "El envío se encuentra en procesamiento." };

    return response(origin, 200, {
      ok: true,
      reference: row.public_reference,
      kind: isCitizen ? "citizen_report" : "municipal_request",
      status: row.status,
      statusLabel: publicStatus.label,
      description: publicStatus.description,
      receivedAt: row.created_at,
      updatedAt: row.updated_at,
      reviewedAt: row.reviewed_at || null,
    });
  } catch (error) {
    console.error("inclume_status_error", error instanceof Error ? error.message : String(error));
    return response(origin, 500, { ok: false, message: "No pudimos consultar el estado en este momento." });
  }
});
