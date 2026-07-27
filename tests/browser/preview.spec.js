const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#parking-list .parking-card")).toHaveCount(5);
});

test("core interface has no serious or critical automated accessibility violations", async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .exclude("#map")
    .exclude(".leaflet-control-container")
    .analyze();

  const severe = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact));
  expect(severe, JSON.stringify(severe, null, 2)).toEqual([]);
  await expect(page.locator("#map")).toHaveAttribute("role", "region");
  await expect(page.locator("#map")).toHaveAttribute("aria-describedby", "map-alternative");
  await expect(page.locator("#parking-list")).toBeVisible();
});

test("accessibility preferences apply immediately and persist", async ({ page }) => {
  await page.getByRole("button", { name: "Accesibilidad" }).click();
  await page.getByLabel("Extra grande").check();
  await page.getByLabel("Alto contraste").check();
  await page.getByLabel("Más espacio").check();
  await page.getByLabel("Reducir movimiento").check();
  await page.getByLabel("Simplificado").check();
  await page.getByRole("button", { name: "Guardar y cerrar" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-text-scale", "x-large");
  await expect(page.locator("html")).toHaveAttribute("data-high-contrast", "true");
  await expect(page.locator("html")).toHaveAttribute("data-spacing", "comfortable");
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");
  await expect(page.locator("html")).toHaveAttribute("data-map-style", "calm");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-text-scale", "x-large");
  await expect(page.locator("html")).toHaveAttribute("data-high-contrast", "true");
  await expect(page.locator("html")).toHaveAttribute("data-map-style", "calm");
});

test("a user can place, describe, persist and remove a Chile geotag", async ({ page }) => {
  await page.getByRole("button", { name: "Marcar estacionamiento" }).click();
  const map = page.locator("#map");
  await map.click({ position: { x: 360, y: 320 } });

  await expect(page.getByRole("dialog", { name: "Describe el punto marcado" })).toBeVisible();
  await page.getByLabel("Nombre o destino").fill("Estacionamiento accesible de prueba");
  await page.getByLabel("Referencia exacta").fill("Acceso norte, junto a la rampa");
  await page.getByLabel("Lado de transferencia").selectOption("right");
  await page.getByLabel("Ruta hasta la entrada").selectOption("yes");
  await page.getByLabel("Observación").fill("Superficie nivelada y señalización visible.");
  await page.getByRole("button", { name: "Guardar punto de prueba" }).click();

  await expect(page.getByRole("heading", { name: "Estacionamiento accesible de prueba" })).toBeVisible();
  const storedCount = await page.evaluate(() => JSON.parse(localStorage.getItem("inclume.preview.chile.points.v4") || "[]").length);
  expect(storedCount).toBe(1);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Estacionamiento accesible de prueba" })).toBeVisible();
  await page.getByRole("button", { name: "Ver detalle" }).first().click();
  await page.getByRole("button", { name: "Eliminar punto local" }).click();
  await expect(page.getByRole("heading", { name: "Estacionamiento accesible de prueba" })).toHaveCount(0);
});

test("coordinate controls provide a non-drag alternative", async ({ page }) => {
  await page.getByRole("button", { name: "Marcar estacionamiento" }).click();
  await page.locator("#map").click({ position: { x: 420, y: 350 } });

  const latitude = page.getByLabel("Latitud");
  const longitude = page.getByLabel("Longitud");
  const originalLatitude = Number(await latitude.inputValue());
  const originalLongitude = Number(await longitude.inputValue());

  await page.getByRole("button", { name: "↑ Norte" }).click();
  await page.getByRole("button", { name: "Este →" }).click();

  expect(Number(await latitude.inputValue())).toBeGreaterThan(originalLatitude);
  expect(Number(await longitude.inputValue())).toBeGreaterThan(originalLongitude);
});

test("search and mobile list-map switch remain functional", async ({ page }) => {
  await page.getByLabel("Buscar en los puntos mostrados").fill("Temuco");
  await expect(page.locator("#parking-list .parking-card")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Punto demo — Temuco" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(page.locator(".map-panel")).toBeVisible();
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page.locator(".results")).toBeVisible();
});
