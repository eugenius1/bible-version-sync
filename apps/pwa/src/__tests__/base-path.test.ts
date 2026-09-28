import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// On GitHub Pages the app lives under /bible-version-sync/, so a path starting
// at the domain root ("/favicon.svg", location.replace("/")) leaves the app for
// the user site. Paths must go through import.meta.env.BASE_URL instead.
const SRC = join(import.meta.dirname, "..");
const ROOT_PATH = /(?:src|href)="\/(?!\/)|(?:location\.(?:assign|replace)|replaceState\([^)]*,)\s*\(?\s*["'`]\/(?!\/)/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("base path", () => {
  it("no source links or navigates to the domain root", () => {
    const offenders = sources(SRC).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line, i) => ({ line, at: `${relative(SRC, file)}:${i + 1}` }))
        .filter(({ line }) => ROOT_PATH.test(line))
        .map(({ at, line }) => `${at}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
