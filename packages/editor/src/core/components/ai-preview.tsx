"use client";

import { useCallback, useState } from "react";

import { $generateHtmlFromNodes } from "@lexical/html";
import { $convertFromMarkdownString } from "@lexical/markdown";
import { createEditor, type Klass, type LexicalEditor, type LexicalNode } from "lexical";

import { MARKDOWN_TRANSFORMERS } from "../extensions/document";
import { documentTheme } from "../lib/theme";

import { HtmlView } from "./html-view";

/**
 * A headless editor with the nodes the Markdown transformers create, so the
 * preview goes through the same conversion as Replace and Insert.
 */
function createPreviewEditor(): LexicalEditor {
  const nodes = new Set<Klass<LexicalNode>>();
  for (const transformer of MARKDOWN_TRANSFORMERS) {
    if ("dependencies" in transformer) {
      transformer.dependencies.forEach((node) => nodes.add(node));
    }
  }
  return createEditor({
    namespace: "JaggleAiPreview",
    theme: documentTheme,
    nodes: [...nodes],
    onError: (error) => {
      throw error;
    },
  });
}

function markdownToHtml(editor: LexicalEditor, markdown: string): string {
  editor.update(
    () => {
      $convertFromMarkdownString(markdown.trim(), MARKDOWN_TRANSFORMERS);
    },
    { discrete: true },
  );
  return editor.read(() => $generateHtmlFromNodes(editor, null));
}

/** Returns a Markdown to HTML converter backed by this component's own headless editor. */
export function useAiPreviewHtml(): (markdown: string) => string {
  const [editor] = useState(createPreviewEditor);
  return useCallback((markdown: string) => markdownToHtml(editor, markdown), [editor]);
}

/** The AI result as it will look once applied, rendered like read-only. */
export function AiPreview({ html }: { html: string }) {
  return <HtmlView html={html} />;
}
