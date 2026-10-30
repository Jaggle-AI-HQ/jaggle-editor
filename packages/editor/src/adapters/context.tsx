"use client";

import { createContext, type ReactNode, useContext } from "react";

import type { EditorAdapters, EditorNotify } from "./types";

/** Every query the editor runs starts with this, apart from the app's own. */
export const EDITOR_QUERY_KEY = "@jaggle-ai-hq/editor";

const NO_ADAPTERS: EditorAdapters = { currentUser: null };

const EditorAdaptersContext = createContext<EditorAdapters>(NO_ADAPTERS);

/**
 * Gives every editor below it the app's adapters. Pass a stable object
 * (`useMemo`): editors re-read it on every change. Editors also need a
 * TanStack Query `QueryClientProvider` above them.
 */
export function EditorProvider({
  adapters,
  children,
}: {
  adapters: EditorAdapters;
  children: ReactNode;
}) {
  return (
    <EditorAdaptersContext.Provider value={adapters}>{children}</EditorAdaptersContext.Provider>
  );
}

export function useEditorAdapters(): EditorAdapters {
  return useContext(EditorAdaptersContext);
}

/* eslint-disable no-console -- the fallback when the app has no notices */
const consoleNotify: EditorNotify = {
  success: (message) => console.info(message),
  error: (message) => console.error(message),
  message: (message) => console.info(message),
  promise: (promise, { error }) =>
    promise.catch((caught: unknown) =>
      console.error(typeof error === "function" ? error(caught) : error),
    ),
};
/* eslint-enable no-console */

/** The app's notices (toasts); the console when it has none. */
export function useNotify(): EditorNotify {
  return useEditorAdapters().notify ?? consoleNotify;
}

const keepSource = (src: string) => Promise.resolve(src);

/** The app's `files.resolveUrl`; without it a stored source stays as it is. */
export function useFileUrlResolver(): (src: string) => Promise<string> {
  return useEditorAdapters().files?.resolveUrl ?? keepSource;
}

/** Reloads the page unless the app handles a refused save itself. */
export function useSaveConflictHandler(): () => void {
  return useEditorAdapters().onSaveConflict ?? (() => window.location.reload());
}
