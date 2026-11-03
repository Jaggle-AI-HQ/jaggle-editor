/**
 * Who else is in a document's live room comes from its awareness states:
 * each editor announces its name, colour and the app's ID for the person.
 */
import { describe, expect, it } from "vitest";

import { presenceFrom } from "../document/collaboration";

type AwarenessState = Parameters<typeof presenceFrom>[0] extends Map<number, infer State> ? State : never;

const state = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  name,
  color: "#f97316",
  focusing: false,
  awarenessData: { id, avatarUrl: null },
  ...extra,
});

describe("presence", () => {
  it("lists the other people in the room, once each", () => {
    const states = new Map<number, AwarenessState>([
      [1, state("me", "Ana")],
      [2, state("bo", "Bo")],
      [3, state("bo", "Bo", { focusing: true })],
      [4, state("cy", "Cy", { awarenessData: { id: "cy", avatarUrl: "https://img.test/cy.png" } })],
    ]);

    expect(presenceFrom(states, 1, "me")).toEqual([
      { id: "bo", name: "Bo", color: "#f97316", avatarUrl: null, focusing: true },
      { id: "cy", name: "Cy", color: "#f97316", avatarUrl: "https://img.test/cy.png", focusing: false },
    ]);
  });

  it("leaves out the person's own other tabs and editors that haven't announced themselves", () => {
    const states = new Map<number, AwarenessState>([
      [1, state("me", "Ana")],
      [2, state("me", "Ana")],
      [3, { color: "#000" }],
      [4, state("", "No ID")],
    ]);

    expect(presenceFrom(states, 1, "me")).toEqual([]);
  });
});
