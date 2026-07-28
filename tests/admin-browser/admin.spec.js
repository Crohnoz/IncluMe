const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

const API_PATTERN = "**/functions/v1/inclume-admin**";

function fixtures() {
  return {
    session: { ok: true, moderator: { label: "enrique-owner" } },
    summary: {
      ok: true,
      metrics: {
        publishedLocations: 1,
        citizenReportsReceived: 3,
        citizenReportsInReview: 1,
        citizenReportsAccepted: 2,
        communesReported: 2,
      },
    },
    citizen_queue: {
      ok: true,
      items: [{
        id: "11111111-1111-4111-8111-111111111111",
        public_reference: "CIU-A1B2C3D4E5F6",
        report_type: "nuevo_estacionamiento",
        commune: "Temuco",
        place_name: "Hospital piloto",
        exact_reference: "Acceso norte junto a la rampa",
        latitude: -38.735900,
        longitude: -72.590400,
        observation: "Espacio señalizado con ruta sin escalones hasta la entrada principal.",
        contact_email: "contacto@example.com",
        status: "pending",
        created_at: "2026-07-28T12:00:00Z",
        updated_at: "2026-07-28T12:00:00Z",
        reviewed_at: null,
        moderator_notes: null,
      }],
    },
    municipal_queue: {
      ok: true,
      items: [{
        id: "22222222-2222-4222-8222-222222222222",
        public_reference: "MUN-0A1B2C3D4E5F",
        institution: "Municipalidad piloto",
        territory: "Temuco",
        contact_name: "Contacto institucional",
        contact_role: "Unidad de inclusión",
        institutional_email: "inclusion@example.cl",
        phone: null,
        objective: "catastro_estacionamientos",
        problem_description: "Necesitamos identificar cobertura y vigencia de estacionamientos accesibles.",
        status: "new",
        created_at: "2026-07-28T13:00:00Z",
        updated_at: "2026-07-28T13:00:00Z",
        internal_notes: null,
      }],
    },
    catalog: {
      ok: true,
      items: [{
        id: "33333333-3333-4333-8333-333333333333",
        name: "Centro comunitario piloto",
        location_reference: "Acceso poniente",
        commune: "Temuco",
        latitude: -38.736100,
        longitude: -72.591000,
        transfer_side: "both",
        step_free: "yes",
        confidence_label: "community_reviewed",
        moderation_status: "approved",
        is_published: true,
        created_at: "2026-07-28T11:00:00Z",
        updated_at: "2026-07-28T11:30:00Z",
      }],
    },
    events: {
      ok: true,
      items: [{
        id: 1,
        entity_type: "citizen_report",
        entity_id: "11111111-1111-4111-8111-111111111111",
        public_reference: "CIU-A1B2C3D4E5F6",
        action: "status_changed",
        previous_status: "pending",
        new_status: "triaged",
        notes: "Revisión inicial.",
        actor_label: "enrique-owner",
        created_at: "2026-07-28T14:00:00Z",
      }],
    },
  };
}

async function mockAdminApi(page, actions) {
  const data = fixtures();
  await page.route(API_PATTERN, async (route) => {
    const request = route.request();
    const authorization = request.headers().authorization || "";
    if (!authorization.startsWith("Bearer IM-")) {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false, message: "Clave administrativa no válida." }) });
      return;
    }

    if (request.method() === "POST") {
      const body = request.postDataJSON();
      actions.push(body);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: "11111111-1111-4111-8111-111111111111" }) });
      return;
    }

    const resource = new URL(request.url()).searchParams.get("resource") || "session";
    const payload = data[resource] || { ok: false, message: "Recurso no disponible." };
    await route.fulfill({ status: payload.ok ? 200 : 404, contentType: "application/json", body: JSON.stringify(payload) });
  });
}

test("el centro inicia sesión, carga colas y ejecuta una decisión auditada", async ({ page }) => {
  const actions = [];
  await mockAdminApi(page, actions);
  await page.goto("/equipo/");

  await expect(page.getByRole("heading", { name: "Centro de moderación." })).toBeVisible();
  await page.getByLabel("Clave administrativa").fill(`IM-${"a".repeat(43)}`);
  await page.getByRole("button", { name: "Ingresar al centro" }).click();

  await expect(page.getByRole("heading", { name: "Moderación y catálogo." })).toBeVisible();
  await expect(page.getByText("Sesión: enrique-owner")).toBeVisible();
  await expect(page.getByText("Hospital piloto")).toBeVisible();
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible();

  expect(await page.evaluate(() => sessionStorage.getItem("inclume.moderator.key.v1"))).toMatch(/^IM-/);
  expect(await page.evaluate(() => localStorage.getItem("inclume.moderator.key.v1"))).toBeNull();

  const reportCard = page.locator("article.item").filter({ hasText: "CIU-A1B2C3D4E5F6" });
  await reportCard.getByLabel("Estado").selectOption("triaged");
  await reportCard.getByLabel("Nota interna").fill("Referencia y coordenadas comprobadas.");
  await reportCard.getByRole("button", { name: "Guardar estado" }).click();

  await expect.poll(() => actions.length).toBe(1);
  expect(actions[0]).toMatchObject({
    action: "citizen_status",
    reference: "CIU-A1B2C3D4E5F6",
    status: "triaged",
    notes: "Referencia y coordenadas comprobadas.",
  });

  await page.getByRole("tab", { name: "Solicitudes municipales" }).click();
  await expect(page.getByText("Municipalidad piloto")).toBeVisible();
  await page.getByRole("tab", { name: "Catálogo" }).click();
  await expect(page.getByText("Centro comunitario piloto")).toBeVisible();
  await page.getByRole("tab", { name: "Auditoría" }).click();
  await expect(page.getByText("status_changed")).toBeVisible();
});

test("la interfaz autenticada no presenta infracciones automáticas de axe", async ({ page }) => {
  const actions = [];
  await mockAdminApi(page, actions);
  await page.goto("/equipo/");
  await page.getByLabel("Clave administrativa").fill(`IM-${"b".repeat(43)}`);
  await page.getByRole("button", { name: "Ingresar al centro" }).click();
  await expect(page.getByRole("heading", { name: "Moderación y catálogo." })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Centro de moderación." })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("inclume.moderator.key.v1"))).toBeNull();
});
