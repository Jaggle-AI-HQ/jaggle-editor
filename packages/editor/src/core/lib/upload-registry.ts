"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { LexicalEditor, NodeKey } from "lexical";

import { uploadErrorMessage } from "../utils/images";

export type UploadKind = "image" | "video" | "audio" | "file";

/** A node's upload as its view shows it. */
export type NodeUpload = {
  /** "finishing": stored, while the stored image loads behind the preview. */
  status: "uploading" | "error" | "finishing";
  /** 0–1. */
  progress: number;
  /** The local file, shown until the stored one is in place. */
  previewUrl: string;
  fileName: string;
  kind: UploadKind;
  error?: string;
  /** Replacing an existing file: cancelling keeps the node as it was. */
  replacing: boolean;
};

export type UploadRun = (
  signal: AbortSignal,
  onProgress: (progress: number) => void,
) => Promise<"finishing" | "done">;

type Job = { run: UploadRun; controller: AbortController | null };

/**
 * Uploads in progress, by node, for this browser only. The document never
 * holds them: until a file is stored its node has no source, so collaborators
 * and saves see an empty block, never a local preview URL.
 */
export class UploadRegistry {
  private uploads = new Map<NodeKey, NodeUpload>();
  private jobs = new Map<NodeKey, Job>();
  private fresh = new Set<NodeKey>();
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  get = (nodeKey: NodeKey): NodeUpload | undefined => this.uploads.get(nodeKey);

  /** Something is still uploading (leaving the page would lose it). */
  hasPending() {
    for (const upload of this.uploads.values()) {
      if (upload.status === "uploading") return true;
    }
    return false;
  }

  start(
    nodeKey: NodeKey,
    file: File,
    kind: UploadKind,
    run: UploadRun,
    { replacing = false }: { replacing?: boolean } = {},
  ) {
    this.clear(nodeKey);
    this.uploads.set(nodeKey, {
      status: "uploading",
      progress: 0,
      previewUrl: URL.createObjectURL(file),
      fileName: file.name,
      kind,
      replacing,
    });
    this.jobs.set(nodeKey, { run, controller: null });
    this.emit();
    void this.execute(nodeKey);
  }

  retry(nodeKey: NodeKey) {
    if (this.uploads.get(nodeKey)?.status !== "error") return;
    this.patch(nodeKey, { status: "uploading", progress: 0, error: undefined });
    void this.execute(nodeKey);
  }

  /** Stops the upload and forgets it; the caller decides what happens to the node. */
  clear(nodeKey: NodeKey) {
    const job = this.jobs.get(nodeKey);
    job?.controller?.abort();
    this.jobs.delete(nodeKey);
    const upload = this.uploads.get(nodeKey);
    if (!upload) return;
    URL.revokeObjectURL(upload.previewUrl);
    this.uploads.delete(nodeKey);
    this.emit();
  }

  /** An empty media block someone just inserted here, so its picker opens. */
  markFresh(nodeKey: NodeKey) {
    this.fresh.add(nodeKey);
  }

  isFresh(nodeKey: NodeKey) {
    return this.fresh.has(nodeKey);
  }

  unmarkFresh(nodeKey: NodeKey) {
    this.fresh.delete(nodeKey);
  }

  dispose() {
    for (const nodeKey of Array.from(this.uploads.keys())) this.clear(nodeKey);
    this.fresh.clear();
  }

  private async execute(nodeKey: NodeKey) {
    const job = this.jobs.get(nodeKey);
    if (!job) return;
    const controller = new AbortController();
    job.controller = controller;
    try {
      const result = await job.run(controller.signal, (progress) => {
        if (!controller.signal.aborted) this.patch(nodeKey, { progress });
      });
      if (controller.signal.aborted) return;
      if (result === "finishing") {
        this.jobs.delete(nodeKey);
        this.patch(nodeKey, { status: "finishing", progress: 1 });
      } else {
        this.clear(nodeKey);
      }
    } catch (caught) {
      if (controller.signal.aborted) return;
      this.patch(nodeKey, { status: "error", error: uploadErrorMessage(caught) });
    }
  }

  private patch(nodeKey: NodeKey, change: Partial<NodeUpload>) {
    const upload = this.uploads.get(nodeKey);
    if (!upload) return;
    this.uploads.set(nodeKey, { ...upload, ...change });
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}

// Node views render where Lexical mounts decorators, outside the document's
// React providers, so the registry is found through the editor instead.
const registries = new WeakMap<LexicalEditor, UploadRegistry>();

/** The editor's registry, created on first use (so StrictMode re-runs share it). */
export function uploadRegistryFor(editor: LexicalEditor): UploadRegistry {
  let registry = registries.get(editor);
  if (!registry) {
    registry = new UploadRegistry();
    registries.set(editor, registry);
  }
  return registry;
}

/** Marks this editor as one that uploads into nodes (see `UploadRegistryProvider`). */
export const UploadRegistryContext = createContext<UploadRegistry | null>(null);

/** The editor's uploads; null in an editor without uploads (comments, previews). */
export function useUploadRegistry(): UploadRegistry | null {
  const [editor] = useLexicalComposerContext();
  return useContext(UploadRegistryContext) ?? registries.get(editor) ?? null;
}

const noSubscribe = () => () => undefined;
const noUpload = () => undefined;

/** This node's upload, if one is in progress (or failed) here. */
export function useNodeUpload(nodeKey: NodeKey): NodeUpload | undefined {
  const registry = useUploadRegistry();
  return useSyncExternalStore(
    registry?.subscribe ?? noSubscribe,
    registry ? () => registry.get(nodeKey) : noUpload,
    noUpload,
  );
}

/** Re-renders whenever any upload changes (the block handle hides on uploading blocks). */
export function useUploadsChanged(): number {
  const registry = useUploadRegistry();
  const [version, setVersion] = useState(0);
  useEffect(
    () => registry?.subscribe(() => setVersion((current) => current + 1)),
    [registry],
  );
  return version;
}

/**
 * Whether an empty media block should open its picker: only one someone just
 * inserted in this browser (not a collaborator's, or one saved empty).
 * Without a registry (outside a document editor) it always does.
 */
export function useFreshPlaceholder(nodeKey: NodeKey): boolean {
  const registry = useUploadRegistry();
  const [fresh] = useState(() => (registry ? registry.isFresh(nodeKey) : true));
  useEffect(() => {
    registry?.unmarkFresh(nodeKey);
  }, [nodeKey, registry]);
  return fresh;
}
