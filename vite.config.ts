import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const ONLINE_API = "http://naoshang.chen1413.com.cn:3000";
const LOCAL_API = "http://localhost:3000";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  // HQ_API_TARGET: online | local（见 .env.development）；trim 防止 = local 这类空格踩坑
  const apiTarget =
    (env.HQ_API_TARGET || "online").trim().toLowerCase() === "local"
      ? LOCAL_API
      : ONLINE_API;
  // Optional override when business APIs are on a different host.
  const businessTarget = env.BUSINESS_API_PROXY_TARGET || apiTarget;

  return {
    plugins: [react()],
    base: "./",
    server: {
      port: 5174,
      host: true,
      proxy: {
        "/api/hq": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/agency": {
          target: businessTarget,
          changeOrigin: true,
        },
        "/stores": {
          target: businessTarget,
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