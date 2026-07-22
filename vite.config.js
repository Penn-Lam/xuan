import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { xuanDocumentBridge } from "./plugins/xuan/mcp/vite-bridge.mjs";
// xuan Vite 配置：React + Tailwind v4（CSS-first，无 config 文件）+ @ 路径别名
export default defineConfig({
    plugins: [xuanDocumentBridge(__dirname), react(), tailwindcss()],
    resolve: {
        alias: { "@": path.resolve(__dirname, "./src") },
    },
});
