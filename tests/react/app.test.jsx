import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import App from "../../src/App.jsx";

afterEach(() => {
  cleanup();
});

describe("React shell", () => {
  it("mounts the legacy product without React dangerous HTML props", async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      expect(
        document.querySelector("style[data-ecotrace-legacy-style]"),
      ).toBeInTheDocument();
    });

    expect(container.querySelector(".skip-link")).toBeInTheDocument();
    expect(screen.getAllByText("EcoTrace").length).toBeGreaterThan(0);
    expect(
      document.querySelector("[data-ecotrace-legacy-runtime]"),
    ).toBeInTheDocument();
  });

  it("does not duplicate the trusted stylesheet when remounted", async () => {
    const first = render(<App />);
    first.unmount();
    render(<App />);

    await waitFor(() => {
      expect(
        document.querySelectorAll("style[data-ecotrace-legacy-style]"),
      ).toHaveLength(1);
    });
  });
});
