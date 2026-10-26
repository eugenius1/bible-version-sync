import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// The preset pads maskable and Apple icons onto white, which leaves a white
// ring around the dark tile once Android or iOS crops it. Fill with the tile's
// own stone-900 instead so the crop is dark edge to edge. 10% padding keeps the
// cross inside the maskable safe zone (a circle of 40% radius).
const fill = { padding: 0.1, resizeOptions: { background: "#1c1917" } };

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, ...fill },
    apple: { ...minimal2023Preset.apple, ...fill },
  },
  images: ["public/favicon.svg"],
});
