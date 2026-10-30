// @vitest-environment happy-dom
import { act, type ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type DocumentHandle,
  DocumentExportDialog,
  type DocumentsAdapter,
  type EditorAdapters,
  EditorProvider,
  LexicalEditor,
  type StoredDocument,
  type VersionsAdapter,
} from "../src/index";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const source = { entityType: "task", entityId: "task-1", roomId: "ws:task-task-1" };
const me = { id: "user-1", name: "Ada Lovelace" };

let mounted: { root: Root; container: HTMLElement } | null = null;

afterEach(async () => {
  if (mounted) {
    const { root, container } = mounted;
    await act(async () => root.unmount());
    container.remove();
    mounted = null;
  }
});

async function mount(adapters: EditorAdapters, children: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <EditorProvider adapters={adapters}>{children}</EditorProvider>
      </QueryClientProvider>,
    );
  });
  mounted = { root, container };
  return container;
}

function memoryDocuments(initial: StoredDocument = { yjsState: null, html: "" }) {
  const saves: { yjsState: string; html: string; revision?: number }[] = [];
  const documents: DocumentsAdapter = {
    load: async () => initial,
    save: async (_identity, document) => {
      saves.push(document);
      return { revision: 1 };
    },
  };
  return { documents, saves };
}

const noVersions: VersionsAdapter = {
  list: async () => [],
  get: async () => {
    throw new Error("none");
  },
  create: async () => undefined,
  rename: async () => undefined,
};

const editorLoaded = (container: HTMLElement) =>
  vi.waitFor(() => expect(container.querySelector("[contenteditable]")).not.toBeNull(), {
    timeout: 5000,
  });

describe("adapters", () => {
  it("offers version history only when the app has a versions adapter", async () => {
    const { documents } = memoryDocuments();
    const without = await mount(
      { currentUser: me, documents },
      <LexicalEditor mode="document" source={source} showComments showVersionHistory />,
    );
    await editorLoaded(without);
    expect(without.querySelector('[aria-label="Version history"]')).toBeNull();
    // Comments live in the document itself, so they need no adapter.
    expect(without.querySelector('[aria-label="Comments"]')).not.toBeNull();
    await act(async () => mounted!.root.unmount());
    without.remove();
    mounted = null;

    const withVersions = await mount(
      { currentUser: me, documents, versions: noVersions },
      <LexicalEditor mode="document" source={source} showComments showVersionHistory />,
    );
    await editorLoaded(withVersions);
    expect(withVersions.querySelector('[aria-label="Version history"]')).not.toBeNull();
  });

  it("offers PDF and Word export only with an exporter", async () => {
    const dialog = (
      <DocumentExportDialog open onOpenChange={() => undefined} html="<p>Hi</p>" title="Notes" />
    );
    await mount({ currentUser: me }, dialog);
    const labels = () => [...document.body.querySelectorAll("button")].map((b) => b.textContent);
    expect(labels().some((text) => text?.includes("PDF"))).toBe(false);
    expect(labels().some((text) => text?.includes("HTML"))).toBe(true);
    await act(async () => mounted!.root.unmount());
    mounted!.container.remove();
    mounted = null;

    await mount({ currentUser: me, exporter: { render: async () => new Blob() } }, dialog);
    expect(labels().some((text) => text?.includes("PDF"))).toBe(true);
  });

  it("saves a document's Y.Doc and HTML through documents.save", async () => {
    const { documents, saves } = memoryDocuments({ yjsState: null, html: "<p>Saved before</p>" });
    let handle: DocumentHandle | null = null;
    const container = await mount(
      { currentUser: me, documents },
      <LexicalEditor mode="document" source={source} onReady={(ready) => (handle = ready)} />,
    );
    await editorLoaded(container);
    await vi.waitFor(() => expect(handle).not.toBeNull(), { timeout: 5000 });
    expect(handle!.getMarkdown()).toContain("Saved before");

    await act(async () => handle!.replaceWithMarkdown("Written in the **test**"));
    // The edit reaches the Y.Doc after Lexical commits it; then it can be saved.
    await vi.waitFor(
      async () => {
        await act(async () => handle!.flush());
        expect(saves.length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );
    const last = saves[saves.length - 1];
    expect(last.html).toContain("Written in the");
    expect(last.yjsState.length).toBeGreaterThan(0);
  });
});
