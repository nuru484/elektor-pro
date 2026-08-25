import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    // Floors, not targets: each sits just under the measured level so a
    // change that drops coverage fails CI while existing code passes. Raise
    // them as coverage grows; never lower them to get green.
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      thresholds: {
        branches: 60,
        functions: 45,
        lines: 65,
        statements: 60,
      },
    },
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
