import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // A separate path keeps portal assets away from the tool pages and player.
  base: "/portal/",
  build: { assetsDir: "assets", assetsInlineLimit: 0, sourcemap: false },
});
