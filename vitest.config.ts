import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true, // needed by @testing-library to cleanup after each test
    include: ["src/**/*.test.{js,jsx,ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*"],
      exclude: ["src/**/*.test.{js,jsx,ts,tsx}", "**/*.d.ts"],
      reporter: ["text", "html", "json"],
      ignoreEmptyLines: true,
    },
    workspace: [
      {
        extends: true,
        test: {
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
        },
      },
    ],
    setupFiles: ["./vitest.setup.ts"],
    env: loadEnv("", process.cwd(), ""),
  },
  optimizeDeps: {
    include: ["vitest > @vitest/expect > chai"],
  },
});
