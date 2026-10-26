/** @vitest-environment jsdom */

import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Step } from "../Step";

const digit = (container: HTMLElement) => container.querySelector("span > span") as HTMLSpanElement;

describe("Step", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("moves the digit by the gap between its ink and its box", () => {
    vi.stubGlobal("CSS", { supports: () => true });
    // A "2" whose ink runs from 1.2px to 6.8px of a 7.6px advance (more room
    // on its left than its right), 8.7px tall, in a box trimmed to 8.5px.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      measureText: () => ({
        actualBoundingBoxLeft: -1.2,
        actualBoundingBoxRight: 6.8,
        actualBoundingBoxAscent: 8.7,
        actualBoundingBoxDescent: 0,
      }),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 7.6, height: 8.5 } as DOMRect);
    const { container } = render(<Step n={2} />);
    // dx = 7.6/2 - (6.8 + 1.2)/2 = -0.2; dy = 8.7/2 - 8.5/2 = 0.1
    expect(digit(container).style.transform).toBe("translate(-0.20px, 0.10px)");
    vi.restoreAllMocks();
  });

  it("leaves the digit be where text-box isn't supported", () => {
    const { container } = render(<Step n={1} />);
    expect(digit(container).textContent).toBe("1");
    expect(digit(container).style.transform).toBe("");
  });
});
