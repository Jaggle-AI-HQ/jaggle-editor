import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    headless: "src/headless.ts",
    kit: "src/kit.ts",
  },
  format: ["esm"],
  // Shared code and the lazily loaded editors (document surface, comment
  // composer) become their own chunks, so they load only when used.
  splitting: true,
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  // Dependencies and peers stay imports; the app's bundler resolves them once.
  // Next.js needs the directive on every client module; other bundlers ignore it.
  banner: { js: '"use client";' },
});
