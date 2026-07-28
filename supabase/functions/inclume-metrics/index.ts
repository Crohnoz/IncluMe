const ALLOWED_ORIGINS = new Set([
  "https://inclume-chile.netlify.app",
  "https://inclume-municipalidades.netlify.app",
  "http://localhost:8888",
  "http://localhost:3000",
]);

function headers(origin: string | null): Record<string, string> {
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return response(origin, 503, { ok: false, message: "Servicio temporalmente no disponible." });

  try {
    const query = await fetch(`${supabaseUrl}/rest/v1/rpc/public_pilot_metrics`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!query.ok) throw new Error(`metrics_${query.status}`);
    const metrics = await query.json();
    return response(origin, 200, { ok: true, metrics });
  } catch (error) {
    console.error("inclume_metrics_error", error instanceof Error ? error.message : String(error));
    return response(origin, 500, { ok: false, message: "No pudimos cargar las métricas reales." });
  }
});
