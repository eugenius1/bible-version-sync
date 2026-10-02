import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

// Strict Content-Security-Policy for production builds. Sign-in tokens live in
// IndexedDB, so blocking injected scripts matters. (Not applied in dev, where
// Vite needs inline scripts for hot reload.)
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self' https://api.youversion.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const csp = (): Plugin => ({
  name: "bvs-csp",
  apply: "build",
  transformIndexHtml: (html) =>
    html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

// Static hosts without an SPA fallback (GitHub Pages) would 404 the sign-in
// redirect before the service worker exists. Pages serves callback.html at
// /callback, so a copy of the app shell there answers it with a 200.
const callbackPage = (): Plugin => {
  let outDir = "";
  return {
    name: "bvs-callback-page",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(resolve(outDir, "index.html"), resolve(outDir, "callback.html"));
    },
  };
};

export default defineConfig({
  // Where the build is served from, e.g. /bible-version-sync/ on GitHub Pages.
  // An env var rather than --base, which npm swallows as its own config flag
  // when the root build script forwards to the workspace one.
  base: process.env.BASE_PATH ?? "/",
  // Port 8001 + /callback matches the redirect URI registered for the app key.
  server: { port: 8001, strictPort: true },
  preview: { port: 8001, strictPort: true },
  test: {
    // Node by default; component tests opt in with a `@vitest-environment jsdom` docblock.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/__tests__/setup.ts"],
  },
  plugins: [
    react(),
    tailwindcss(),
    csp(),
    callbackPage(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Bible Version Sync",
        short_name: "Version Sync",
        description: "Keep your YouVersion highlights in sync across Bible versions.",
        theme_color: "#1c1917",
        background_color: "#fafaf9",
        display: "standalone",
        // Relative, so the installed app opens wherever the build is hosted.
        start_url: ".",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,txt}"],
        navigateFallback: "index.html",
      },
    }),
  ],
});
