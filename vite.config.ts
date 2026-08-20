import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// T002: GitHub Pages "Deploy from a branch" (main / /docs) — no CI/CD (research.md §9).
// `base` must match the repository name so built asset URLs resolve under the
// project-pages subpath; `build.outDir` points builds at the committed /docs folder,
// which is the actual deployed artifact (see .gitignore — /docs is intentionally
// NOT ignored).
//
// T006: ExcelJS's browser build depends on Node's `Buffer` global, which Vite does not
// polyfill by default. `vite-plugin-node-polyfills` is scoped to just `buffer` (not a
// full Node-compat shim) to keep the static bundle's "no hidden Node dependency" posture
// intact — see research.md §2 for the full rationale and the required manual real-Excel
// verification step this alone cannot replace.
export default defineConfig({
  base: "/APP-Project-Scoresheet/",
  build: {
    outDir: "docs",
  },
  plugins: [
    react(),
    nodePolyfills({
      include: ["buffer"],
      globals: {
        Buffer: true,
        global: true,
        process: false,
      },
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
});
