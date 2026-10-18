import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { I18nProvider } from "./i18n";
import { Lab } from "./lab/Lab";
import { labRoute } from "./lab/route";
import "./index.css";

registerSW({ immediate: true });

// The UI lab swaps whole style sheets per library, so moving into, out of or
// within it starts the page afresh rather than stacking them up.
const lab = labRoute();
addEventListener("hashchange", () => {
  if (lab || labRoute()) location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      {lab ? <Lab route={lab} /> : <App />}
    </I18nProvider>
  </StrictMode>,
);
