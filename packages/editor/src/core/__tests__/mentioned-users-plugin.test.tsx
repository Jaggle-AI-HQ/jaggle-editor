// @vitest-environment happy-dom
import { act } from "react";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { createRoot, type Root } from "react-dom/client";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type LexicalEditor,
  type ParagraphNode,
} from "lexical";
import { afterEach, describe, expect, it, vi } from "vitest";

import { $createMentionNode, MentionNode } from "../nodes/mention-node";
import { MentionedUsersPlugin } from "../plugins/mentioned-users-plugin";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mounted: { root: Root; container: HTMLElement } | null = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => mounted!.root.unmount());
    mounted.container.remove();
    mounted = null;
  }
});

async function setup(onChange: (ids: string[]) => void) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted = { root, container };
  let editor!: LexicalEditor;
  await act(async () => {
    root.render(
      <LexicalComposer
        initialConfig={{
          namespace: "test",
          nodes: [MentionNode],
          onError: (error) => {
            throw error;
          },
          editorState: (created) => {
            editor = created;
            $getRoot().append($createParagraphNode());
          },
        }}
      >
        <MentionedUsersPlugin onChange={onChange} />
      </LexicalComposer>,
    );
  });
  return {
    update: (fn: () => void) => act(async () => editor.update(fn, { discrete: true })),
  };
}

const paragraph = () => $getRoot().getFirstChildOrThrow<ParagraphNode>();
const person = (id: string) => $createMentionNode({ entityType: "user", entityId: id, title: id });

describe("MentionedUsersPlugin", () => {
  it("reports the set once per change, not per keystroke", async () => {
    const onChange = vi.fn();
    const { update } = await setup(onChange);
    expect(onChange).not.toHaveBeenCalled();

    await update(() => paragraph().append($createTextNode("hi ")));
    await update(() => paragraph().append($createTextNode("there")));
    expect(onChange).not.toHaveBeenCalled();

    await update(() => paragraph().append(person("ada")));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(["ada"]);

    await update(() => paragraph().append($createTextNode(" more text")));
    expect(onChange).toHaveBeenCalledTimes(1);

    await update(() => paragraph().append(person("bo")));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(["ada", "bo"]);
  });

  it("de-duplicates people and ignores mentions of records", async () => {
    const onChange = vi.fn();
    const { update } = await setup(onChange);
    await update(() => {
      paragraph().append(
        person("ada"),
        person("ada"),
        $createMentionNode({ entityType: "task", entityId: "t1", title: "A task" }),
      );
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(["ada"]);

    // A second mention of someone already listed changes nothing.
    await update(() => paragraph().append(person("ada")));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("reports [] when the draft is cleared", async () => {
    const onChange = vi.fn();
    const { update } = await setup(onChange);
    await update(() => paragraph().append(person("ada")));
    await update(() => {
      const root = $getRoot();
      root.clear();
      root.append($createParagraphNode());
    });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
