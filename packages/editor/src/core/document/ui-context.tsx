"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { DocumentExportType } from "../../lib/document-transfer";

import type { MentionScope } from "../lib/types";

export type AnchorPoint = { top: number; left: number };

export type DocumentUi = {
  /** Scopes workspace lookups such as board assignees. */
  workspaceId?: string;
  /** Who `@` can mention (see `MentionScope`); unset means the route's project or workspace. */
  mentionScope?: MentionScope;
  showComments: boolean;
  openComments: () => void;
  openAi: (anchor: AnchorPoint) => void;
  /** Opens the versions sidebar. Unset when version history is off. */
  openVersions?: () => void;
  /** Opens the import dialog. Unset when import is off. */
  openImport?: () => void;
  /** Downloads the document in a format. Unset when export is off. */
  exportAs?: (format: DocumentExportType) => void;
};

function unset() {
  return undefined;
}

const DocumentUiContext = createContext<DocumentUi>({
  showComments: false,
  openComments: unset,
  openAi: unset,
});

export function DocumentUiProvider({
  value,
  children,
}: {
  value: DocumentUi;
  children: ReactNode;
}) {
  return (
    <DocumentUiContext.Provider value={value}>
      {children}
    </DocumentUiContext.Provider>
  );
}

export function useDocumentUi() {
  return useContext(DocumentUiContext);
}
