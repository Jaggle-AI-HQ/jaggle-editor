import {
  createYjsBinding,
  type Provider,
  syncLexicalUpdateToYjs,
  syncYjsChangesToLexical,
} from "@lexical/yjs";
import {
  CLEAR_HISTORY_COMMAND,
  HISTORY_MERGE_TAG,
  type LexicalEditor,
  mergeRegister,
  type SerializedEditorState,
  SKIP_COLLAB_TAG,
} from "lexical";
import * as Y from "yjs";

import { $replaceWithHtml } from "../lib/transfer";

/**
 * A Lexical Y.Doc bound to an editor without a live room: the same layout
 * (the default `"root"` XmlText) that Lexical's CollaborationPlugin reads, so
 * the two are interchangeable. Used to read a saved snapshot (`yjs_state`, a
 * version) into a headless editor, for example to restore a version.
 *
 * Mirrors `useYjsCollaboration` from `@lexical/react`, without awareness or
 * cursors. The editor keeps its own undo history.
 */

const DOC_ID = "main";

/** The binding reports cursors and presence through a provider; offline there are none. */
function offlineProvider(): Provider {
  const states = new Map();
  const noop = () => undefined;
  return {
    awareness: {
      getLocalState: () => null,
      getStates: () => states,
      off: noop,
      on: noop,
      setLocalState: noop,
      setLocalStateField: noop,
    },
    connect: noop,
    disconnect: noop,
    off: noop,
    on: noop,
  };
}

export function encodeDocState(doc: Y.Doc): string {
  const update = Y.encodeStateAsUpdate(doc);
  let binary = "";
  for (let index = 0; index < update.length; index += 0x8000) {
    binary += String.fromCharCode(...update.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export function decodeDocState(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export type DocumentSeed =
  /** A saved Lexical Y.Doc (base64 `yjs_state`). */
  | { kind: "yjs"; state: string }
  /** Content to import once, into an empty document (older formats, new documents). */
  | { kind: "import"; $populate: (editor: LexicalEditor) => void };

/**
 * Binds `editor` to `doc` and fills it from `seed`. The editor must start
 * empty (`$initialEditorState: null`), since only content that goes through
 * the binding is kept in the Y.Doc. Loading is not an undoable step.
 */
export function registerDocumentYjs(
  editor: LexicalEditor,
  doc: Y.Doc,
  seed: DocumentSeed,
): () => void {
  const binding = createYjsBinding({
    editor,
    id: DOC_ID,
    doc,
    docMap: new Map([[DOC_ID, doc]]),
  });
  const provider = offlineProvider();
  const sharedRoot = binding.root.getSharedType();

  const onYjsChanges = (
    events: Y.YEvent<Y.XmlText>[],
    transaction: Y.Transaction,
  ) => {
    if (transaction.origin !== binding) {
      syncYjsChangesToLexical(binding, provider, events as never, false);
    }
  };
  sharedRoot.observeDeep(onYjsChanges);

  const unregister = mergeRegister(
    () => sharedRoot.unobserveDeep(onYjsChanges),
    editor.registerUpdateListener(
      ({ prevEditorState, editorState, dirtyLeaves, dirtyElements, normalizedNodes, tags }) => {
        if (!tags.has(SKIP_COLLAB_TAG)) {
          syncLexicalUpdateToYjs(
            binding,
            provider,
            prevEditorState,
            editorState,
            dirtyElements,
            dirtyLeaves,
            normalizedNodes,
            tags,
          );
        }
      },
    ),
  );

  if (seed.kind === "yjs") {
    // Applied after the observer is in place, so it arrives as changes.
    Y.applyUpdate(doc, decodeDocState(seed.state), "load");
  } else {
    binding.isBootstrapping = true;
    editor.update(
      () => seed.$populate(editor),
      {
        tag: HISTORY_MERGE_TAG,
        onUpdate: () => {
          binding.isBootstrapping = false;
        },
      },
    );
  }
  // The load lands in the next commit; drop it from the undo stack afterwards.
  editor.update(() => undefined, {
    onUpdate: () => editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined),
  });

  return unregister;
}

/**
 * Reads a saved Lexical Y.Doc (base64) into Lexical JSON, through a headless
 * editor with the document's nodes.
 */
/** A document's editor state from saved HTML, through the editor's importer. */
export function readHtmlState(
  html: string,
  createEditor: () => LexicalEditor & { dispose?: () => void },
): SerializedEditorState {
  const editor = createEditor();
  editor.update(() => $replaceWithHtml(html), { discrete: true });
  const json = editor.getEditorState().toJSON();
  editor.dispose?.();
  return json;
}

export async function readDocState(
  state: string,
  createEditor: () => LexicalEditor & { dispose?: () => void },
): Promise<SerializedEditorState> {
  const editor = createEditor();
  const dispose = registerDocumentYjs(editor, new Y.Doc(), { kind: "yjs", state });
  // Yjs changes reach the editor in its next commit.
  await new Promise<void>((resolve) => {
    editor.update(() => undefined, { onUpdate: resolve });
  });
  const json = editor.getEditorState().toJSON();
  dispose();
  editor.dispose?.();
  return json;
}
