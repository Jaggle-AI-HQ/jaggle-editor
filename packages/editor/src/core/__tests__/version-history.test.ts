/**
 * Version history folds autosaves in a row into one entry, so a busy day
 * reads as a few lines, and names who saved them.
 */
import { describe, expect, it } from "vitest";

import {
  authorsLabel,
  dayEntries,
  type PreviewVersion,
} from "../components/versions-sidebar";

let next = 0;
function version(auto: boolean, author?: string): PreviewVersion {
  next += 1;
  return {
    id: `v${next}`,
    name: auto ? "Autosave" : `Version #${next}`,
    createdAt: next,
    auto,
    html: null,
    author,
  };
}

describe("version history", () => {
  it("folds autosaves in a row and keeps named versions on their own", () => {
    const [a1, a2, named, a3] = [version(true), version(true), version(false), version(true)];
    expect(dayEntries([a1, a2, named, a3])).toEqual([
      { type: "autosaves", versions: [a1, a2] },
      { type: "version", version: named },
      { type: "autosaves", versions: [a3] },
    ]);
  });

  it("names up to two people who saved, then counts the rest", () => {
    expect(authorsLabel([version(true, "Ana"), version(true, "Ana")])).toBe("Ana");
    expect(authorsLabel([version(true, "Ana"), version(true, "Bo")])).toBe("Ana, Bo");
    expect(
      authorsLabel([
        version(true, "Ana"),
        version(true, "Bo"),
        version(true, "Cy"),
        version(true, "Di"),
      ]),
    ).toBe("Ana, Bo +2");
    expect(authorsLabel([version(true)])).toBe("");
  });
});
