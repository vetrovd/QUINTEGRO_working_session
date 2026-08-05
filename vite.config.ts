import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Единственный тестовый шов — домен. Он не знает про браузер,
    // поэтому DOM-окружение не нужно (ADR 0002).
    environment: "node",
    include: ["src/domain/**/*.test.ts"],
  },
});
