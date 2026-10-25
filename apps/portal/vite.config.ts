import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: { alias: { "@cogniate/portal-sdk": fileURLToPath(new URL("./src/sdk/index.ts", import.meta.url)) } },
  server: { fs: { allow: [fileURLToPath(new URL("../../", import.meta.url))] } },
  plugins: [react(), tailwindcss()],
  // A separate path keeps portal assets away from the tool pages and player.
  base: "/portal/",
  build: { assetsDir: "assets", assetsInlineLimit: 0, sourcemap: false },
});
