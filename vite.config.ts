import { sentryVitePlugin } from "@sentry/vite-plugin";
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from "vite-plugin-pwa";
import tsconfigPaths from "vite-tsconfig-paths";
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: "pomo-org",
      project: "pomo-app",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
    tsconfigPaths(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
        type: "module", // Add this for development
      },
      strategies: "injectManifest",
      srcDir: "src/workers",
      filename: "sw.ts",
      injectManifest: {
        // Enable source maps if needed
        sourcemap: true,
      },
      manifest: {
        name: "Service Worker Demo",
        short_name: "SW Demo",
        description: "Basic Service Worker Demo",
        theme_color: "#ffffff",
        icons: [
          {
            src: "/vite.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
        ],
      },
    }),
  ],

  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    deps: {
      inline: ["@dnd-kit/core", "@dnd-kit/sortable"],
    },
  },

  build: {
    sourcemap: true,
  },
});
