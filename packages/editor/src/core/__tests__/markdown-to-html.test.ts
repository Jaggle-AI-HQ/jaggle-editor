// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { documentHtmlFromMarkdown } from "../document/headless";

describe("documentHtmlFromMarkdown", () => {
  it("writes Markdown (AI output) as the editor's HTML", () => {
    const html = documentHtmlFromMarkdown(
      "## Summary\n\nTasks are **on track**.\n\n- Done: 4\n- Open: 2",
    );
    const dom = new DOMParser().parseFromString(html, "text/html");
    expect(dom.querySelector("h2")?.textContent).toBe("Summary");
    expect(dom.querySelector("p")?.textContent).toBe("Tasks are on track.");
    expect(dom.querySelector("p b, p strong")?.textContent).toBe("on track");
    expect([...dom.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "Done: 4",
      "Open: 2",
    ]);
  });
});
