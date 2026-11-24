/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { sendFeedback } from "../../lib/analytics";
import { FeedbackPage } from "../Feedback";

vi.mock("../../lib/analytics", () => ({ sendFeedback: vi.fn() }));
const send = vi.mocked(sendFeedback);

const fill = (message: string, email = "") => {
  render(<I18nProvider><FeedbackPage /></I18nProvider>);
  fireEvent.change(screen.getByLabelText("Your feedback"), { target: { value: message } });
  if (email) fireEvent.change(screen.getByLabelText("Email (optional, for a reply)"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
};

describe("FeedbackPage", () => {
  beforeEach(() => send.mockReset());

  it("sends the feedback and email, trimmed, and thanks the person", async () => {
    send.mockResolvedValue(true);
    fill("  Love it  ", " me@example.test ");
    expect(await screen.findByRole("status")).toHaveTextContent("Your feedback was sent.");
    expect(send).toHaveBeenCalledWith("Love it", "me@example.test");
  });

  it("says so when it couldn't be sent, and keeps what was typed", async () => {
    send.mockResolvedValue(false);
    fill("Broken");
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't be sent");
    expect(screen.getByLabelText("Your feedback")).toHaveValue("Broken");
  });

  it("can't be sent empty", () => {
    render(<I18nProvider><FeedbackPage /></I18nProvider>);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
});
