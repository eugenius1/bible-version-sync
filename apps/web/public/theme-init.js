// Runs before first paint and mirrors resolveTheme() in src/theme.ts, so the
// correct palette is in place before anything is drawn. A file rather than an
// inline script because the Content-Security-Policy forbids inline scripts.
try {
  var saved = localStorage.getItem("bible-version-sync.theme");
  var dark =
    saved === "dark" ||
    ((!saved || saved === "system") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) {
    document.documentElement.classList.add("dark");
    document.querySelector('meta[name="theme-color"]').setAttribute("content", "#0c0a09");
  }
} catch (e) {
  /* blocked storage: fall through to the light default */
}
