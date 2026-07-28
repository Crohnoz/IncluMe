const ALLOWED_ORIGINS = new Set([
  "https://inclume-chile.netlify.app",
  "https://inclume-municipalidades.netlify.app",
  "http://localhost:8888",
  "http://localhost:3000",
]);

function headers(origin: string | null): HeadersInit {
  const values: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) values["Access-Control-Allow-Origin"] = origin;
  return values;
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    if (!origin || !ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: headers(origin) });
  }
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, message: "Método no permitido." }), { status: 405, headers: headers(origin) });
  }
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return new Response(JSON.stringify({ ok: false, message: "Origen no permitido." }), { status: 403, headers: headers(origin) });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ ok: false, message: "Servicio temporalmente no disponible." }), { status: 503, headers: headers(origin) });
  }

  const params = new URLSearchParams({
    select: "id,name,location_reference,commune,latitude,longitude,transfer_side,step_free,notes,confidence_label,updated_at",
    moderation_status: "eq.approved",
    is_published: "eq.true",
    order: "updated_at.desc",
    limit: "200",
  });

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/parking_locations?${params.toString()}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    if (!response.ok) throw new Error(`catalog_${response.status}`);
    const rows = await response.json();
    const points = rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      location: row.location_reference,
      commune: row.commune,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      transferSide: row.transfer_side,
      stepFree: row.step_free,
      notes: row.notes,
      confidenceLabel: row.confidence_label,
      updatedAt: row.updated_at,
      pending: false,
      demo: false,
    }));
    return new Response(JSON.stringify({ ok: true, count: points.length, points }), { status: 200, headers: headers(origin) });
  } catch (error) {
    console.error("inclume_catalog_error", error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ ok: false, message: "No pudimos cargar el catálogo." }), { status: 500, headers: headers(origin) });
  }
});
