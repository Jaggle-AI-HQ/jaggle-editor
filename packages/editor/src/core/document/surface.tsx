"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";

import { HistoryExtension } from "@lexical/history";
import { LexicalCollaboration } from "@lexical/react/LexicalCollaborationContext";
import { LexicalExtensionComposer } from "@lexical/react/LexicalExtensionComposer";
import { useExtensionSignalValue } from "@lexical/react/useExtensionSignalValue";
import { $setSelection, configExtension, defineExtension } from "lexical";
import * as Y from "yjs";

import { useEditorAdapters, useNotify } from "../../adapters/context";
import type { DocumentExportType } from "../../lib/document-transfer";
import { cn } from "../../lib/utils";

import { AiMenu } from "../components/ai-menu";
import { CommentsSidebar } from "../components/comments-sidebar";
import { ImportDialog } from "../components/import-dialog";
import { IncompleteDocumentNotice } from "../components/incomplete-document-notice";
import { EXPORT_FORMATS, ShellActions } from "../components/shell-actions";
import {
  type PreviewVersion,
  RestoreVersionDialog,
  usePreviewVersions,
  VersionPreviewBar,
  VersionPreviewContent,
  VersionsSidebar,
} from "../components/versions-sidebar";
import { CommentExtension } from "../extensions/comment";
import { DocumentExtension } from "../extensions/document";
import { useTranslation } from "../lib/locale";
import { $replaceWithHtml } from "../lib/transfer";
import type { LexicalEditorProps } from "../lib/types";
import { ActiveLinePlaceholderPlugin } from "../plugins/active-line-placeholder-plugin";
import { AutoEmbedPlugin } from "../plugins/auto-embed-plugin";
import { ChangePlugin } from "../plugins/change-plugin";
import { AiPickerPlugin } from "../plugins/component-picker/ai-picker-plugin";
import {
  BoardPickerPlugin,
  EquationPickerPlugin,
  PollPickerPlugin,
  ToggleHeadingPickerPlugin,
  TweetPickerPlugin,
  YouTubePickerPlugin,
} from "../plugins/component-picker/block-picker-plugins";
import { BulletedListPickerPlugin } from "../plugins/component-picker/bulleted-list-picker-plugin";
import { CardPickerPlugin } from "../plugins/component-picker/card-picker-plugin";
import { CheckListPickerPlugin } from "../plugins/component-picker/check-list-picker-plugin";
import { CodePickerPlugin } from "../plugins/component-picker/code-picker-plugin";
import { CollapsiblePickerPlugin } from "../plugins/component-picker/collapsible-picker-plugin";
import { ColumnsPickerPlugin } from "../plugins/component-picker/columns-picker-plugin";
import { ComponentPicker } from "../plugins/component-picker/component-picker-plugin";
import { DateTimePickerPlugin } from "../plugins/component-picker/datetime-picker-plugin";
import { DividerPickerPlugin } from "../plugins/component-picker/divider-picker-plugin";
import { EditorActionsPickerPlugin } from "../plugins/component-picker/editor-actions-picker-plugin";
import { HeadingPickerPlugin } from "../plugins/component-picker/heading-picker-plugin";
import { ImagePickerPlugin } from "../plugins/component-picker/image-picker-plugin";
import {
  AudioPickerPlugin,
  FilePickerPlugin,
  VideoPickerPlugin,
} from "../plugins/component-picker/media-picker-plugin";
import { NumberedListPickerPlugin } from "../plugins/component-picker/numbered-list-picker-plugin";
import { ParagraphPickerPlugin } from "../plugins/component-picker/paragraph-picker-plugin";
import { PullQuotePickerPlugin } from "../plugins/component-picker/pullquote-picker-plugin";
import { QuotePickerPlugin } from "../plugins/component-picker/quote-picker-plugin";
import { ReviewPickerPlugin } from "../plugins/component-picker/review-picker-plugin";
import { TablePickerPlugin } from "../plugins/component-picker/table-picker-plugin";
import { ContentEditable } from "../plugins/content-editable";
import { DraggableBlockPlugin } from "../plugins/draggable-block-plugin";
import { EmojiPickerPlugin } from "../plugins/emoji-picker-plugin";
import {
  CommentPlugin,
  useLatestCommentActivity,
} from "../plugins/floating/comment-plugin";
import { FindReplacePanelPlugin } from "../plugins/floating/find-replace-panel";
import { FloatingToolbarPlugin } from "../plugins/floating/floating-toolbar-plugin";
import { LinkEditorPlugin } from "../plugins/floating/link-editor-plugin";
import { TableCellActionMenuPlugin } from "../plugins/floating/table-cell-action-menu-plugin";
import { TableCellResizerPlugin } from "../plugins/floating/table-cell-resizer-plugin";
import { TableHoverActionsPlugin } from "../plugins/floating/table-hover-actions-plugin";
import { ImageUploadPlugin } from "../plugins/image-upload-plugin";
import { MediaUploadPlugin } from "../plugins/media-upload-plugin";
import { MentionPlugin } from "../plugins/mention-plugin";
import { TogglePlugin } from "../plugins/toggle-plugin";
import { AiToolbarPlugin } from "../plugins/toolbar/ai-toolbar-plugin";
import { CommentToolbarPlugin } from "../plugins/toolbar/comment-toolbar-plugin";
import { LinkToolbarPlugin } from "../plugins/toolbar/link-toolbar-plugin";
import { UploadRegistryProvider } from "../plugins/upload-registry";

import { DocumentCollaboration, type DocumentProvider } from "./collaboration";
import {
  hasReadState,
  ThreadActionsProvider,
  ThreadStorePlugin,
  useUnreadComments,
} from "./comment-threads";
import { DocumentLoading } from "./document-loading";
import { DocumentHandlePlugin } from "./handle-plugin";
import { DOCUMENT_LAYOUT } from "./layout";
import {
  type DocumentPersistence,
  DocumentPersistencePlugin,
  savedRevisionOf,
} from "./persistence";
import { type CommentAuthor, createThreadActions, type ThreadSync } from "./thread-store";
import { type AnchorPoint, DocumentUiProvider, useDocumentUi } from "./ui-context";
import { type LoadedDocument, useDocumentLoad } from "./use-document-load";
import { useDocumentTransfer } from "./use-document-transfer";
import { useDocumentVersions } from "./use-document-versions";
import { useStickyPanelStyle } from "./use-sticky-panels";
import { useUnseenActivity } from "./use-unseen-activity";

type DocumentPanel = "comments" | "versions" | null;

function DocumentChrome({
  page,
  sideMenu,
  placeholder,
  ai,
}: {
  page: boolean;
  sideMenu: boolean;
  placeholder: string;
  /** The app has AI writing (an `ai` adapter). */
  ai: boolean;
}) {
  const { t } = useTranslation();
  const placeholderText = placeholder || t.typeSomething;

  return (
    <div
      className={cn(
        "relative",
        page ? DOCUMENT_LAYOUT.pageColumn : sideMenu && DOCUMENT_LAYOUT.handleSpace,
      )}
    >
      <div className="relative">
        <ContentEditable
          variant="draggable"
          placeholder={placeholderText}
          className="min-h-80"
        />
        <ActiveLinePlaceholderPlugin placeholder={placeholderText} />
        <TableHoverActionsPlugin />
        <TableCellResizerPlugin />
        <TableCellActionMenuPlugin />
      </div>
      <FloatingToolbarPlugin>
        <LinkToolbarPlugin />
        <CommentToolbarPlugin />
        {ai ? <AiToolbarPlugin /> : null}
      </FloatingToolbarPlugin>
      <CommentPlugin />
      <FindReplacePanelPlugin />
      <LinkEditorPlugin />
      <MentionPlugin constrainToEditor />
      <EmojiPickerPlugin />
      <AutoEmbedPlugin />
      <ComponentPicker>
        {ai ? <AiPickerPlugin /> : null}
        <ParagraphPickerPlugin />
        <HeadingPickerPlugin />
        <TablePickerPlugin />
        <NumberedListPickerPlugin />
        <BulletedListPickerPlugin />
        <CheckListPickerPlugin />
        <QuotePickerPlugin />
        <CodePickerPlugin />
        <DividerPickerPlugin />
        <ColumnsPickerPlugin />
        <ImagePickerPlugin />
        <VideoPickerPlugin />
        <AudioPickerPlugin />
        <FilePickerPlugin />
        <CardPickerPlugin />
        <CollapsiblePickerPlugin />
        <DateTimePickerPlugin />
        <PullQuotePickerPlugin />
        <ReviewPickerPlugin />
        <ToggleHeadingPickerPlugin />
        <PollPickerPlugin />
        <BoardPickerPlugin />
        <EquationPickerPlugin />
        <TweetPickerPlugin />
        <YouTubePickerPlugin />
        <EditorActionsPickerPlugin />
      </ComponentPicker>
      <TogglePlugin />
      {sideMenu ? <DraggableBlockPlugin /> : null}
    </div>
  );
}

/** A saved document's live state, when the editor has a `source`. */
type DocumentRuntime = {
  doc: Y.Doc;
  loaded: LoadedDocument;
  user: NonNullable<ReturnType<typeof useDocumentLoad>["user"]>;
  providerRef: { current: DocumentProvider | null };
  persistenceRef: { current: DocumentPersistence | null };
};

type DocumentShell = {
  runtime: DocumentRuntime | null;
  panel: DocumentPanel;
  setPanel: Dispatch<SetStateAction<DocumentPanel>>;
  aiAnchor: AnchorPoint | null;
  setAiAnchor: (anchor: AnchorPoint | null) => void;
  importOpen: boolean;
  setImportOpen: (open: boolean) => void;
};

function DocumentWorkspace({
  placeholder = "",
  workspaceId,
  page = false,
  sideMenu = true,
  imageScope,
  showComments = false,
  showVersionHistory = false,
  showImport = false,
  showExport = false,
  header,
  title,
  onChange,
  source,
  onSaveStatusChange,
  onReady,
  shell,
}: LexicalEditorProps & { shell: DocumentShell }) {
  const { runtime, panel, setPanel, aiAnchor, setAiAnchor, importOpen, setImportOpen } =
    shell;
  // Saving waits until the document has loaded (and saved HTML has been
  // imported), so opening a document is never saved as an edit.
  const { t } = useTranslation();
  const { threads, ai } = useEditorAdapters();
  const toast = useNotify();
  const [ready, setReady] = useState(!runtime);
  // Comments live in the document's Y.Doc; without a saved document, in a
  // page-only one.
  const [localDoc] = useState(() => new Y.Doc());
  const threadDoc = runtime?.doc ?? localDoc;
  const me = useMemo<CommentAuthor>(
    () =>
      runtime
        ? { id: runtime.user.id, name: runtime.user.name, avatarUrl: runtime.user.avatarUrl }
        : { id: "you", name: t.you },
    [runtime, t.you],
  );
  const hasRuntime = runtime !== null;
  // Keyed on the document, not the `source` object: a page passing it inline
  // makes a new one each render, which would reload the threads every time.
  const entityType = source?.entityType;
  const entityId = source?.entityId;
  const documentKey = source?.documentKey;
  const threadSync = useMemo<ThreadSync | null>(
    () =>
      hasRuntime && entityType && entityId && threads
        ? { identity: { entityType, entityId, documentKey }, api: threads }
        : null,
    [documentKey, entityId, entityType, hasRuntime, threads],
  );
  const threadActions = useMemo(
    () => createThreadActions(threadDoc, me, threadSync, toast),
    [me, threadDoc, threadSync, toast],
  );
  const outerUi = useDocumentUi();
  const transfer = useDocumentTransfer({ imageScope, title });
  const { exportAs: runExport } = transfer;
  const exportAs = useCallback(
    (format: DocumentExportType) => {
      const entry = EXPORT_FORMATS.find((item) => item.format === format);
      const label = entry ? t[entry.label] : format;
      toast.promise(runExport(format), {
        loading: t.exportPreparing.replace("{format}", label),
        success: t.exportDone.replace("{format}", label),
        error: (error: unknown) =>
          error instanceof Error ? error.message : t.exportFailed,
      });
    },
    [runExport, t, toast],
  );
  // Export needs the editor, so it joins the page actions inside the composer.
  const ui = useMemo(
    () => ({ ...outerUi, exportAs: showExport ? exportAs : undefined }),
    [exportAs, outerUi, showExport],
  );
  // A saved document's versions come from the API; otherwise sample ones.
  const sampleVersions = usePreviewVersions();
  const savedVersions = useDocumentVersions(source, runtime?.doc ?? null);
  const versions = runtime ? savedVersions : sampleVersions;
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<PreviewVersion | null>(null);
  const previewVersion =
    panel === "versions"
      ? (versions.versions.find((version) => version.id === previewId) ?? null)
      : null;
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);
  const [topElement, setTopElement] = useState<HTMLDivElement | null>(null);
  const panelStyle = useStickyPanelStyle(rootElement, topElement);
  // Dots, not counts: only activity since the panel was last open.
  const seenKey = imageScope ? `jaggle:document-seen:${imageScope.entityId}` : null;
  const latestComment = useLatestCommentActivity(me.id);
  const serverReadState = hasReadState(threadSync);
  const localCommentsUnseen = useUnseenActivity(
    serverReadState ? null : seenKey && `${seenKey}:comments`,
    latestComment,
    panel === "comments",
  );
  // A saved document's dot follows the server's read marker, on any device.
  const threadList = useExtensionSignalValue(CommentExtension, "comments");
  const savedCommentsUnseen = useUnreadComments(
    threadSync,
    threadList,
    me.id,
    panel === "comments",
  );
  const commentsUnseen = serverReadState ? savedCommentsUnseen : localCommentsUnseen;
  const versionsUnseen = useUnseenActivity(
    seenKey && `${seenKey}:versions`,
    versions.versions.reduce(
      (latest, version) => (version.auto ? latest : Math.max(latest, version.createdAt)),
      0,
    ),
    panel === "versions",
  );
  const hasActions =
    showComments || showVersionHistory || showImport || showExport;
  const hasHeader =
    header?.start != null || header?.end != null || header?.trailing != null;

  const shellActions = (floating: boolean) => (
    <ShellActions
      floating={floating}
      showComments={showComments}
      showVersionHistory={showVersionHistory}
      showImport={showImport}
      showExport={showExport}
      commentsOpen={panel === "comments"}
      versionsOpen={panel === "versions"}
      commentsUnseen={commentsUnseen}
      versionsUnseen={versionsUnseen}
      onToggleComments={() => {
        setPanel((current) => (current === "comments" ? null : "comments"));
      }}
      onToggleVersions={() => {
        setPreviewId(null);
        setPanel((current) => (current === "versions" ? null : "versions"));
      }}
      onImport={() => setImportOpen(true)}
      onExportAs={exportAs}
    />
  );

  return (
    <DocumentUiProvider value={ui}>
    <ThreadActionsProvider value={threadActions}>
    <ThreadStorePlugin doc={threadDoc} sync={threadSync} me={me} ready={ready} />
    <UploadRegistryProvider>
    <ImageUploadPlugin scope={imageScope}>
      <MediaUploadPlugin scope={imageScope}>
        {/* Fills a bounded parent: the document scrolls under the header and the
            sidebars stay put. In a parent without a height it flows with its content. */}
        <div
          ref={setRootElement}
          data-document-root=""
          className={DOCUMENT_LAYOUT.root}
          style={panelStyle}
        >
          {hasHeader || previewVersion ? (
            // Header and version bar stay on top while either the editor or the page scrolls.
            <div ref={setTopElement} data-document-topbar="" className="sticky top-0 z-20 shrink-0">
              {hasHeader ? (
                <div className={DOCUMENT_LAYOUT.headerRow}>
                  <div className={DOCUMENT_LAYOUT.headerStart}>{header?.start}</div>
                  {header?.end != null ? (
                    <div className={DOCUMENT_LAYOUT.headerEnd}>{header.end}</div>
                  ) : null}
                  {hasActions ? shellActions(false) : null}
                  {header?.trailing != null ? (
                    <div className={DOCUMENT_LAYOUT.headerEnd}>{header.trailing}</div>
                  ) : null}
                </div>
              ) : null}
              {previewVersion ? (
                <VersionPreviewBar
                  version={previewVersion}
                  onBack={() => setPreviewId(null)}
                  onRestore={() => setRestoreTarget(previewVersion)}
                />
              ) : null}
            </div>
          ) : null}
          <div className="flex min-h-0 min-w-0 flex-1">
            <div className="relative min-w-0 flex-1 overflow-y-auto">
              {hasActions && !hasHeader ? (
                <div className="sticky top-0 z-20 h-0">
                  <div className="absolute end-3 top-3">{shellActions(true)}</div>
                </div>
              ) : null}
              {previewVersion ? (
                <VersionPreviewContent version={previewVersion} source={source} />
              ) : null}
              {/* Keeps the first line clear of the corner actions. The editor
                  stays mounted (hidden) while a version is previewed. */}
              <div
                className={cn(
                  hasActions &&
                    !hasHeader &&
                    !page &&
                    DOCUMENT_LAYOUT.cornerActionsSpace,
                  previewVersion && "hidden",
                )}
              >
                <DocumentChrome
                  page={page}
                  sideMenu={sideMenu}
                  placeholder={placeholder}
                  ai={Boolean(ai)}
                />
              </div>
            </div>
            {panel === "comments" ? (
              <CommentsSidebar onClose={() => setPanel(null)} />
            ) : null}
            {panel === "versions" ? (
              <VersionsSidebar
                versions={versions.versions}
                previewId={previewVersion?.id ?? null}
                onPreview={setPreviewId}
                onSave={versions.save}
                onRename={versions.rename}
                onRequestRestore={setRestoreTarget}
                onClose={() => {
                  setPreviewId(null);
                  setPanel(null);
                }}
              />
            ) : null}
          </div>
        </div>
        <RestoreVersionDialog
          version={restoreTarget}
          onCancel={() => setRestoreTarget(null)}
          onConfirm={(version) => {
            versions.restore(version);
            setPreviewId(null);
            setRestoreTarget(null);
          }}
        />
        {onChange ? <ChangePlugin onChange={onChange} /> : null}
        {runtime && source ? (
          <>
            <DocumentCollaboration
              doc={runtime.doc}
              identity={source}
              roomId={source.roomId}
              revision={runtime.loaded.revision ?? 0}
              seed={runtime.loaded.seed}
              user={runtime.user}
              providerRef={runtime.providerRef}
              onReady={() => {
                // Past the import of saved HTML, which the room does on sync.
                setTimeout(() => setReady(true), 500);
              }}
            />
            <DocumentPersistencePlugin
              source={source}
              doc={runtime.doc}
              providerRef={runtime.providerRef}
              ready={ready}
              initialRevision={runtime.loaded.revision}
              onStatusChange={onSaveStatusChange}
              persistenceRef={runtime.persistenceRef}
            />
          </>
        ) : null}
        {onReady ? (
          <DocumentHandlePlugin
            ready={ready}
            onReady={onReady}
            persistenceRef={runtime?.persistenceRef ?? EMPTY_PERSISTENCE}
          />
        ) : null}
        {aiAnchor && ai ? (
          <AiMenu
            anchor={aiAnchor}
            workspaceId={workspaceId}
            onClose={() => setAiAnchor(null)}
          />
        ) : null}
        {showImport ? (
          <ImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            transfer={transfer}
          />
        ) : null}
      </MediaUploadPlugin>
    </ImageUploadPlugin>
    </UploadRegistryProvider>
    </ThreadActionsProvider>
    </DocumentUiProvider>
  );
}

const EMPTY_PERSISTENCE = { current: null };

/** One live editing session: a Y.Doc for one revision of the document. */
type DocumentSession = Pick<DocumentRuntime, "doc" | "providerRef" | "persistenceRef"> & {
  revision: number;
};

function createSession(revision: number): DocumentSession {
  return {
    revision,
    doc: new Y.Doc(),
    providerRef: { current: null },
    persistenceRef: { current: null },
  };
}

/**
 * The document editor. With a `source` it loads the saved document first,
 * then edits it in its live room and saves it; without one it edits the
 * caller's content (`initialEditorState`, else `html`) and reports changes
 * (`onChange`).
 */
export default function DocumentSurface(editorProps: LexicalEditorProps) {
  const { versions } = useEditorAdapters();
  // Version history needs a saved document and the app's `versions` adapter.
  const props = {
    ...editorProps,
    showVersionHistory: Boolean(
      editorProps.showVersionHistory && editorProps.source && versions,
    ),
  };
  const { source } = props;
  const load = useDocumentLoad(source);
  const [session, setSession] = useState<DocumentSession | null>(null);

  // A write from outside the editor (Jaggle Brain, the API) moves the saved
  // revision. The editor then starts over in that revision's room with the
  // new content, instead of keeping the old text and saving it back over the
  // write. A revision this editor's own save was given is not such a write.
  const loadedRevision = load.document?.revision ?? 0;
  if (load.document) {
    if (!session) {
      setSession(createSession(loadedRevision));
    } else if (
      loadedRevision > session.revision &&
      loadedRevision > (savedRevisionOf(session.doc) ?? session.revision)
    ) {
      setSession(createSession(loadedRevision));
    }
  }

  if (source && (load.loading || !load.document || !load.user)) {
    return (
      <DocumentLoading
        page={props.page}
        header={props.header}
        notice={
          load.incomplete || load.failed ? (
            <IncompleteDocumentNotice
              purpose="edit"
              failed={load.failed}
              onRetry={load.retry}
              retrying={load.retrying}
            />
          ) : undefined
        }
        hasActions={
          props.showComments ||
          props.showVersionHistory ||
          props.showImport ||
          props.showExport
        }
      />
    );
  }

  if (source && !session) return null;

  const runtime =
    source && session && load.document && load.user
      ? {
          doc: session.doc,
          loaded: load.document,
          user: load.user,
          providerRef: session.providerRef,
          persistenceRef: session.persistenceRef,
        }
      : null;
  return <DocumentComposer key={session?.revision} {...props} runtime={runtime} />;
}

function DocumentComposer({
  runtime,
  ...props
}: LexicalEditorProps & { runtime: DocumentRuntime | null }) {
  const {
    workspaceId,
    showComments = false,
    showVersionHistory = false,
    showImport = false,
    initialEditorState,
    html,
    mentionScope,
  } = props;
  // Read once, like the comment composer: the editor is created from the
  // first value, and later prop changes do not reset the document.
  const [extension] = useState(() => {
    if (runtime) {
      // A saved document fills from its Y.Doc, and undo comes from Yjs (only
      // your own edits), so the editor starts empty without its own history.
      return defineExtension({
        name: "@jaggle/lexical/document-collaborative",
        dependencies: [DocumentExtension, configExtension(HistoryExtension, { disabled: true })],
        $initialEditorState: null,
      });
    }
    if (initialEditorState) {
      return defineExtension({
        name: "@jaggle/lexical/document-initial-state",
        dependencies: [DocumentExtension],
        $initialEditorState: JSON.stringify(initialEditorState),
      });
    }
    return html?.trim()
      ? defineExtension({
          name: "@jaggle/lexical/document-initial-html",
          dependencies: [DocumentExtension],
          // No selection: the editor must not take focus when it mounts.
          $initialEditorState: () => {
            $replaceWithHtml(html);
            $setSelection(null);
          },
        })
      : DocumentExtension;
  });
  const [panel, setPanel] = useState<DocumentPanel>(null);
  const [aiAnchor, setAiAnchor] = useState<AnchorPoint | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  // Node views (images, media, boards) render beside the composer's children,
  // so the provider sits above the composer for them to reach it.
  const ui = useMemo(
    () => ({
      workspaceId,
      mentionScope,
      showComments,
      openComments: () => setPanel("comments"),
      openAi: (point: AnchorPoint) => setAiAnchor(point),
      openVersions: showVersionHistory ? () => setPanel("versions") : undefined,
      openImport: showImport ? () => setImportOpen(true) : undefined,
    }),
    [mentionScope, showComments, showImport, showVersionHistory, workspaceId],
  );

  const composer = (
    <LexicalExtensionComposer extension={extension} contentEditable={null}>
      <DocumentWorkspace
        {...props}
        shell={{
          runtime,
          panel,
            setPanel,
            aiAnchor,
            setAiAnchor,
          importOpen,
          setImportOpen,
        }}
      />
    </LexicalExtensionComposer>
  );

  return (
    <DocumentUiProvider value={ui}>
      {runtime ? <LexicalCollaboration>{composer}</LexicalCollaboration> : composer}
    </DocumentUiProvider>
  );
}
