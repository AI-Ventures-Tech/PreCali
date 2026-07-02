import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Vitest no resuelve los path aliases de tsconfig.json por defecto.
// Mapeamos "@" → src/ para que los imports `@/lib/...` funcionen bajo el runner.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
