import { afterEach } from "vitest";

/**
 * Only touches the DOM when a test file has opted into jsdom, so node-only
 * suites are unaffected.
 */
if (typeof document !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  await import("@testing-library/jest-dom/vitest");
  afterEach(() => {
    cleanup();
    // The language and theme controls both persist; a leaked value would make
    // results depend on test order.
    try {
      localStorage.clear();
    } catch {
      /* storage may be unavailable */
    }
    document.documentElement.className = "";
    document.documentElement.lang = "";
  });
}
