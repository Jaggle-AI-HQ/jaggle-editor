"use client";

import { useEffect, useRef } from "react";

import { $generateHtmlFromNodes } from "@lexical/html";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useQueryClient } from "@tanstack/react-query";
import { $getRoot, type LexicalEditor } from "lexical";
import type * as Y from "yjs";


import { useEditorAdapters, useNotify, useSaveConflictHandler } from "../../adapters/context";
import type { DocumentSaveStatus, DocumentSource } from "../lib/types";

import { type DocumentProvider, LOAD_ORIGIN } from "./collaboration";
import { versionsQueryKey } from "./use-document-versions";
import { HYDRATE_ORIGIN } from "./thread-store";
import { encodeDocState } from "./yjs-binding";

/** Same cadence as the old editor. */
const SAVE_DELAY_MS = 3000;
const VERSION_IDLE_MS = 5 * 60 * 1000;
const VERSION_MIN_GAP_MS = 10 * 60 * 1000;
const CONTENT_TEXT_LENGTH = 500;

/**
 * The saved revision, shared in the Y.Doc: whoever saves records the revision
 * the backend returned, so everyone in the room sends the latest one (task
 * descriptions refuse a stale revision).
 */
const META_KEY = "lexical-document-meta";

/** The revision this document's own saves were last accepted at, if any. */
export function savedRevisionOf(doc: Y.Doc): number | undefined {
  const revision = doc.getMap<number>(META_KEY).get("revision");
  return typeof revision === "number" ? revision : undefined;
}
const META_ORIGIN = "jaggle:document-meta";

export type DocumentPersistence = {
  /** Saves pending changes now. */
  flush: () => Promise<void>;
};

function readContent(editor: LexicalEditor) {
  return editor.getEditorState().read(() => ({
    html: $generateHtmlFromNodes(editor, null),
    text: $getRoot().getTextContent(),
  }));
}

/**
 * Saves the document's Y.Doc plus HTML through the app's `documents.save`
 * after local edits: remote edits and the initial load are not saves of this
 * person's work. Saves pending work when the editor unmounts or the tab is
 * hidden, and makes automatic versions after a few idle minutes, at most one
 * per ten minutes.
 *
 * A refused save (409: the document moved on elsewhere) stops saving and asks
 * to reload, since continuing would overwrite it.
 */
export function DocumentPersistencePlugin({
  source,
  doc,
  providerRef,
  ready,
  initialRevision,
  onStatusChange,
  persistenceRef,
}: {
  source: DocumentSource;
  doc: Y.Doc;
  providerRef: { current: DocumentProvider | null };
  /** False until the document has loaded (and saved HTML, if any, been imported). */
  ready: boolean;
  initialRevision: number | undefined;
  onStatusChange?: (status: DocumentSaveStatus) => void;
  persistenceRef: { current: DocumentPersistence | null };
}) {
  const [editor] = useLexicalComposerContext();
  const queryClient = useQueryClient();
  const { documents, versions } = useEditorAdapters();
  const toast = useNotify();
  const onSaveConflict = useSaveConflictHandler();
  const onStatusRef = useRef(onStatusChange);
  // Read when saving, so a new adapters object doesn't restart the save loop.
  const appRef = useRef({ documents, versions, toast, onSaveConflict });
  useEffect(() => {
    onStatusRef.current = onStatusChange;
    appRef.current = { documents, versions, toast, onSaveConflict };
  }, [documents, onSaveConflict, onStatusChange, toast, versions]);

  useEffect(() => {
    if (!ready) return;
    const identity = {
      entityType: source.entityType,
      entityId: source.entityId,
      documentKey: source.documentKey,
    };
    const meta = doc.getMap<number>(META_KEY);
    let revision = initialRevision;
    const latestRevision = () => {
      const shared = meta.get("revision");
      if (typeof shared === "number" && (revision === undefined || shared > revision)) {
        revision = shared;
      }
      return revision;
    };
    let dirty = false;
    let blocked = false;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let versionTimer: ReturnType<typeof setTimeout> | undefined;
    let lastVersionAt = Date.now();
    let changedSinceVersion = false;
    let inFlight: Promise<void> | null = null;
    let erroredOnce = false;

    const setStatus = (status: DocumentSaveStatus) => onStatusRef.current?.(status);

    const save = async (): Promise<void> => {
      if (blocked || !dirty) return;
      if (inFlight) {
        await inFlight;
        return save();
      }
      const app = appRef.current;
      if (!app.documents) return;
      dirty = false;
      setStatus("saving");
      const { html } = readContent(editor);
      inFlight = app.documents
        .save(identity, { yjsState: encodeDocState(doc), html, revision: latestRevision() })
        .then((saved) => {
          if (typeof saved?.revision === "number" && saved.revision !== revision) {
            revision = saved.revision;
            doc.transact(() => meta.set("revision", saved.revision as number), META_ORIGIN);
          }
          erroredOnce = false;
          setStatus(dirty ? "saving" : "saved");
        })
        .catch((error: unknown) => {
          const conflict = app.documents?.conflictMessage?.(error) ?? null;
          setStatus("error");
          if (conflict) {
            blocked = true;
            app.toast.error(conflict, {
              duration: Infinity,
              action: { label: "Reload", onClick: () => appRef.current.onSaveConflict() },
            });
            return;
          }
          // Keep the changes and try again with the next edit.
          dirty = true;
          if (!erroredOnce) {
            erroredOnce = true;
            app.toast.error("Couldn't save this document. Your changes are kept and will retry.");
          }
        })
        .finally(() => {
          inFlight = null;
        });
      await inFlight;
    };

    const saveVersion = () => {
      const { versions } = appRef.current;
      if (!versions || blocked || !changedSinceVersion) return;
      if (Date.now() - lastVersionAt < VERSION_MIN_GAP_MS) return;
      changedSinceVersion = false;
      lastVersionAt = Date.now();
      const { html, text } = readContent(editor);
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      void versions
        .create(identity, {
          state: encodeDocState(doc),
          html,
          text: text.slice(0, CONTENT_TEXT_LENGTH),
          changeSummary: `${words} words`,
          auto: true,
        })
        .then(() =>
          queryClient.invalidateQueries({
            queryKey: versionsQueryKey(identity),
          }),
        )
        .catch(() => {
          // An automatic version is best effort; the next idle period tries again.
          changedSinceVersion = true;
        });
    };

    const onUpdate = (_update: Uint8Array, origin: unknown) => {
      // The saved state being loaded, threads loaded from the API, or someone
      // else's edit arriving: none of them is this person's work to save.
      if (
        origin === LOAD_ORIGIN ||
        origin === HYDRATE_ORIGIN ||
        origin === META_ORIGIN ||
        origin === providerRef.current?.ws
      ) {
        return;
      }
      dirty = true;
      changedSinceVersion = true;
      setStatus("saving");
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => void save(), SAVE_DELAY_MS);
      clearTimeout(versionTimer);
      versionTimer = setTimeout(saveVersion, VERSION_IDLE_MS);
    };
    doc.on("update", onUpdate);

    const flush = async () => {
      clearTimeout(saveTimer);
      await save();
    };
    persistenceRef.current = { flush };

    const onHidden = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHidden);

    return () => {
      doc.off("update", onUpdate);
      document.removeEventListener("visibilitychange", onHidden);
      clearTimeout(versionTimer);
      persistenceRef.current = null;
      // Pending work is saved even though the editor is going away.
      void flush();
      saveVersion();
    };
  }, [
    doc,
    editor,
    initialRevision,
    persistenceRef,
    providerRef,
    queryClient,
    ready,
    source.documentKey,
    source.entityId,
    source.entityType,
  ]);

  return null;
}
