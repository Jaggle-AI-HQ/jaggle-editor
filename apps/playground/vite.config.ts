import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // One copy of each, as an app installing the package would have.
  resolve: { dedupe: ["react", "react-dom", "lexical", "yjs", "@tanstack/react-query"] },
});
