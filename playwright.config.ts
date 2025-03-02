import { defineConfig, devices } from "@playwright/test";

// use process.env.PORT by default and fallback to 3000
const PORT = process.env.PORT || 3000;

// set webServer.url and use baseUrl with the location of the WebServer respecting the correct set port
const baseURL = `http://localhost:${PORT}`;

// see https://playwright.dev/docs/test-configuration
export default defineConfig({
  testDir: "./tests",

  // look for files with the .spec.ts or .e2e.ts extension
  testMatch: "*.@(spec|e2e).?(c|m)[jt]s?(x)",

  // timeout per test
  timeout: 30 * 1000,

  // fail the build on ci if accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // reporter to use, see https://playwright.dev/docs/test-reporters
  reporter: process.env.CI ? "github" : "list",

  expect: {
    // set timeout for async expect matchers
    timeout: 10 * 1000,
  },

  // run local dev server before starting the tests
  // https://playwright.dev/docs/test-advanced#launching-a-development-web-server-during-the-tests
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev:next",
    url: baseURL,
    timeout: 2 * 60 * 1000,
    reuseExistingServer: !process.env.CI,
  },

  // share settings for all the projects below, see https://playwright.dev/docs/api/class-testoptions
  use: {
    // use baseURL so to make navigation relative
    // more information: https://playwright.dev/docs/api/class-testoptions#test-options-base-url
    baseURL,

    // collect trace when retrying the failed test, see https://playwright.dev/docs/trace-viewer
    trace: process.env.CI ? "retain-on-failure" : undefined,

    // record videos when retrying the failed test.
    video: process.env.CI ? "retain-on-failure" : undefined,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    ...(process.env.CI
      ? [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
          },
        ]
      : []),
  ],
});
