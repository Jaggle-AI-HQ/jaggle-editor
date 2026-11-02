// @vitest-environment happy-dom
/**
 * Code blocks follow each viewer's light or dark mode without writing it into
 * the shared document: the stored colours come from the block's own theme and
 * the DOM carries both modes' colours for styles.css to pick from.
 */
import { $createCodeNode, $isCodeHighlightNode, $isCodeNode, type CodeNode } from "@lexical/code";
import { buildEditorFromExtensions } from "@lexical/extension";
import githubDark from "@shikijs/themes/github-dark";
import githubLight from "@shikijs/themes/github-light";
import {
  $createTextNode,
  $getRoot,
  defineExtension,
  type LexicalEditor,
  type LexicalEditorWithDispose,
} from "lexical";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CODE_THEME_COLORS, CodeExtension } from "../extensions/code";

const SOURCE = 'function greet(name) {\n  // say hello\n  return "hi " + name + 1;\n}';

const editors: LexicalEditorWithDispose[] = [];

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.dispose());
  document.body.replaceChildren();
  document.documentElement.classList.remove("dark");
});

function mountCodeBlock(theme?: string) {
  const editor = buildEditorFromExtensions(
    defineExtension({ name: "test/code-theme", dependencies: [CodeExtension] }),
  );
  editors.push(editor);
  const root = document.createElement("div");
  root.contentEditable = "true";
  document.body.append(root);
  editor.setRootElement(root);
  editor.update(
    () => {
      const code = $createCodeNode("javascript");
      if (theme) {
        code.setTheme(theme);
      }
      $getRoot().clear().append(code.append($createTextNode(SOURCE)));
    },
    { discrete: true },
  );
  return editor;
}

type Rendered = { theme?: string; stored: string[]; light: string[]; dark: string[] };

/** Per character of the source: the stored colour and the two painted ones. */
function rendered(editor: LexicalEditor): Rendered {
  return editor.read(() => {
    const code = $getRoot().getFirstChild() as CodeNode;
    const out: Rendered = { theme: code.getTheme(), stored: [], light: [], dark: [] };
    for (const node of code.getChildren()) {
      if (!$isCodeHighlightNode(node)) {
        continue;
      }
      const style = editor.getElementByKey(node.getKey())!.style;
      const stored = /color:\s*(#\w+)/i.exec(node.getStyle())?.[1].toLowerCase() ?? "";
      for (let i = 0; i < node.getTextContentSize(); i++) {
        out.stored.push(stored);
        out.light.push(style.getPropertyValue("--lexical-code-light"));
        out.dark.push(style.getPropertyValue("--lexical-code-dark"));
      }
    }
    return out;
  });
}

async function highlighted(editor: LexicalEditor) {
  await vi.waitFor(
    () => {
      const tokens = editor.read(() => {
        const code = $getRoot().getFirstChild();
        return $isCodeNode(code) ? code.getChildren().filter($isCodeHighlightNode) : [];
      });
      expect(tokens.length).toBeGreaterThan(10);
    },
    { timeout: 10_000 },
  );
  return rendered(editor);
}

describe("code block colours", () => {
  it("highlights new blocks with github-light and paints each mode's colours, even in dark mode", async () => {
    document.documentElement.classList.add("dark");
    const light = await highlighted(mountCodeBlock());
    // A block saved in dark mode by 0.2.1 or earlier.
    const dark = await highlighted(mountCodeBlock("github-dark"));

    expect(light.theme).toBe("github-light");
    expect(dark.theme).toBe("github-dark");
    expect(light.stored).not.toEqual(dark.stored);
    for (const block of [light, dark]) {
      expect(block.light).toEqual(light.stored);
      expect(block.dark).toEqual(dark.stored);
    }
  });

  it("writes nothing to the document when the mode changes", async () => {
    const editor = mountCodeBlock();
    await highlighted(editor);
    const state = editor.getEditorState();

    document.documentElement.classList.add("dark");
    await new Promise((resolve) => setTimeout(resolve, 20));
    document.documentElement.classList.remove("dark");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(editor.getEditorState()).toBe(state);
  });

  it("pairs every github-light colour with its github-dark twin", () => {
    const scopes = (theme: typeof githubLight) => theme.tokenColors!.map((rule) => rule.scope);
    expect(scopes(githubDark)).toEqual(scopes(githubLight));

    const pairs = [
      [githubLight.colors!["editor.foreground"], githubDark.colors!["editor.foreground"]],
      ...githubLight.tokenColors!.map((rule, i) => [
        rule.settings.foreground,
        githubDark.tokenColors![i].settings.foreground,
      ]),
    ].filter(([lightColor]) => lightColor);
    const key = (pair: (string | undefined)[]) => pair.join(" ").toLowerCase();
    expect(new Set(CODE_THEME_COLORS.map(key))).toEqual(new Set(pairs.map(key)));
  });
});
