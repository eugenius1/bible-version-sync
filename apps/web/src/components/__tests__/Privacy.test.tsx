/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { usageAllowed } from "../../lib/analytics";
import { PrivacyPage } from "../Privacy";

afterEach(() => vi.unstubAllGlobals());

describe("PrivacyPage", () => {
  it("starts off, and says why, when the browser asks not to be tracked", () => {
    vi.stubGlobal("navigator", { ...navigator, globalPrivacyControl: true });
    render(<I18nProvider><PrivacyPage /></I18nProvider>);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/asks sites not to track you/)).toBeInTheDocument();
  });

  it("turns usage data off and on again, and remembers it", () => {
    render(<I18nProvider><PrivacyPage /></I18nProvider>);
    const toggle = screen.getByRole("switch", { name: "Send anonymous usage data" });
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(usageAllowed()).toBe(false);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(usageAllowed()).toBe(true);
  });

  it("says what is never sent", () => {
    render(<I18nProvider><PrivacyPage /></I18nProvider>);
    expect(screen.getByText(/never sends verses, highlights/)).toBeInTheDocument();
  });
});
