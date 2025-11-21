import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_GOOGLE_API_KEY": JSON.stringify(env.VITE_GOOGLE_API_KEY),
    },
  };
});
