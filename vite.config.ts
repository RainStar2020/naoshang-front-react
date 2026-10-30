import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react()],
    base: "./",
    server: {
      port: 5174,
      host: true,
      proxy: {
        "/api/hq": {
          target: env.HQ_API_PROXY_TARGET || "http://192.168.0.44:3001",
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
      chunkSizeWarningLimit: 1500,
    },
  };
});
