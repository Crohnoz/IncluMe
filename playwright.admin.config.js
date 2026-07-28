const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/admin-browser",
  timeout: 30000,
  expect: { timeout: 7000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "python scripts/build_netlify_municipal.py && python -m http.server 4174 --directory netlify-municipal-dist",
    url: "http://127.0.0.1:4174/equipo/",
    reuseExistingServer: true,
    timeout: 20000,
  },
});
