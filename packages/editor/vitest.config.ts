import { defineConfig } from "vitest/config";

export default defineConfig({
  // The editor's CSS is plain CSS for the app's Tailwind; tests don't load it.
  css: { postcss: { plugins: [] } },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
  },
});
