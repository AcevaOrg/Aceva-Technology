import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * The confirmation screen no longer offers "Email me my blueprint" while the
 * feature is switched off. The API refuses it regardless (see
 * tests/api/pulseBlueprintEmailDisabled.test.ts); this only proves the UI does
 * not present a control that cannot work. The flag is mocked through a
 * mutable object so the same render can prove the button would appear if the
 * flag were on, which is what makes the absence meaningful.
 */

const flags = vi.hoisted(() => ({ blueprintEmail: false, pulseIdLookupDetails: false }));
vi.mock("@/lib/pulse/features", () => ({ PULSE_FEATURES: flags }));

import PulseMessages from "@/components/pulse/PulseMessages";
import { PulseProvider, initialState } from "@/components/pulse/PulseContext";
import type { PulseState } from "@/components/pulse/types";

const confirmed: PulseState = {
  ...initialState,
  open: true,
  stage: "confirmation",
  lead: { name: "Synthetic Visitor", contact: "synthetic.visitor@example.test", method: "Email" },
  id: "PLS-261030-401",
};

function renderConfirmation(): string {
  return renderToStaticMarkup(
    React.createElement(PulseProvider, null, React.createElement(PulseMessages, { state: confirmed, dispatch: () => undefined }))
  );
}

describe("the confirmation screen", () => {
  it("offers no blueprint email while the feature is off", () => {
    flags.blueprintEmail = false;
    const html = renderConfirmation();

    expect(html).not.toMatch(/EMAIL ME MY BLUEPRINT/);
    // The safe actions remain.
    expect(html).toMatch(/DOWNLOAD WORD BLUEPRINT/);
    expect(html).toMatch(/COPY ID/);
    expect(html).toContain("PLS-261030-401");
  });

  it("would offer it if the feature were switched back on", () => {
    flags.blueprintEmail = true;
    try {
      expect(renderConfirmation()).toMatch(/EMAIL ME MY BLUEPRINT/);
    } finally {
      flags.blueprintEmail = false;
    }
  });
});
