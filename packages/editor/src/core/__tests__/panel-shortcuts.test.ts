/**
 * The document panels open from the keyboard as in Google Docs: version
 * history with Ctrl+Alt+Shift+H, comments with Ctrl+Alt+Shift+A (⌘⌥⇧ on a
 * Mac). Matched on the key's code, since Alt changes the typed character.
 */
import { describe, expect, it } from "vitest";

import { matchesPanelShortcut, PANEL_SHORTCUTS } from "../components/shell-actions";

const press = (code: string, keys: Partial<Record<"ctrlKey" | "metaKey" | "altKey" | "shiftKey", boolean>>) => ({
  code,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...keys,
});

describe("panel shortcuts", () => {
  it("opens version history and comments with Ctrl+Alt+Shift", () => {
    const all = { ctrlKey: true, altKey: true, shiftKey: true };
    expect(matchesPanelShortcut(press("KeyH", all), PANEL_SHORTCUTS.versions)).toBe(true);
    expect(matchesPanelShortcut(press("KeyA", all), PANEL_SHORTCUTS.comments)).toBe(true);
    expect(matchesPanelShortcut(press("KeyA", all), PANEL_SHORTCUTS.versions)).toBe(false);
  });

  it("leaves other combinations alone", () => {
    expect(matchesPanelShortcut(press("KeyH", { ctrlKey: true, shiftKey: true }), PANEL_SHORTCUTS.versions)).toBe(false);
    expect(matchesPanelShortcut(press("KeyH", { ctrlKey: true, altKey: true }), PANEL_SHORTCUTS.versions)).toBe(false);
    expect(
      matchesPanelShortcut(press("KeyH", { ctrlKey: true, metaKey: true, altKey: true, shiftKey: true }), PANEL_SHORTCUTS.versions),
    ).toBe(false);
  });
});
