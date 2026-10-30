"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CollaborationPlugin } from "@lexical/react/LexicalCollaborationPlugin";
import type { Provider } from "@lexical/yjs";
import type { LexicalEditor } from "lexical";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

import { useEditorAdapters } from "../../adapters/context";
import type { CollaborationAdapter, DocumentIdentity } from "../../adapters/types";

import { $replaceWithHtml } from "../lib/transfer";

import { decodeDocState } from "./yjs-binding";

/**
 * Live collaboration for a saved document: the same y-websocket server and
 * room naming as the old editor, with ":lexical" added so a Lexical Y.Doc never
 * shares a room with a BlockNote one. Lexical's CollaborationPlugin does the
 * syncing, remote cursors and (Yjs) undo.
 *
 * Content comes from the backend, not the room: the saved Y.Doc is applied
 * when the provider connects (after the plugin observes the document), and
 * people already in the room merge with it, since everyone's state descends
 * from the same saved state. Saved HTML (content set outside the editor) is
 * imported only into a room that is still empty once synced.
 *
 * The room name carries the saved revision. Editor saves keep it; a write from
 * outside the editor (an automation, the AI planner, an API update) bumps it
 * and clears the saved Y.Doc. Whoever opens the document next joins a new,
 * empty room seeded from the new HTML instead of the old room, whose content
 * would otherwise be saved back over the outside write. People still in the
 * old room get "changed elsewhere" on their next save and reload.
 *
 * The server is the app's `collaboration` adapter. Without one the document
 * is edited (and saved) alone, through the same Y.Doc.
 */

/** Never connected: stands in for the server when the app has none. */
const NO_SERVER = "ws://localhost.invalid";

/** Without the live server, the document still opens (and saves) after this long. */
const OFFLINE_AFTER_MS = 4000;

export const DOCUMENT_DOC_ID = "main";

/** Transaction origin of the saved state, so loading is not taken for an edit. */
export const LOAD_ORIGIN = "jaggle:document-load";

export type DocumentSeed =
  | { kind: "yjs"; state: string }
  | { kind: "html"; html: string }
  | { kind: "empty" };

export type CollaborationUser = {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string;
};

type SyncListener = (isSynced: boolean) => void;

/** The Lexical room for a document at a saved revision. */
export function documentRoomName(roomId: string, revision: number) {
  return `${roomId}:lexical:r${revision}`;
}

/**
 * Adapts y-websocket to the plugin: applies the saved state on connect, and
 * reports "synced" after `OFFLINE_AFTER_MS` when the server can't be reached,
 * so the document still opens and a new one is still seeded. Without a
 * server it never connects and reports "synced" at once.
 */
export class DocumentProvider {
  readonly ws: WebsocketProvider;
  readonly awareness: Provider["awareness"];
  private readonly doc: Y.Doc;
  private readonly live: boolean;
  private seed: DocumentSeed;
  private syncListeners = new Set<SyncListener>();
  private offlineTimer: ReturnType<typeof setTimeout> | undefined;
  private reportedSync = false;
  /** Between `connect()` and `disconnect()`. */
  active = false;
  /** Called on the first "synced", real or offline. */
  onReady: (() => void) | null = null;

  constructor(
    doc: Y.Doc,
    room: string,
    seed: DocumentSeed,
    server: { url: string; WebSocketPolyfill?: typeof WebSocket } | null,
  ) {
    this.doc = doc;
    this.seed = seed;
    this.live = server !== null;
    this.ws = new WebsocketProvider(server?.url ?? NO_SERVER, room, doc, {
      connect: false,
      ...(server?.WebSocketPolyfill ? { WebSocketPolyfill: server.WebSocketPolyfill } : {}),
    });
    this.awareness = this.ws.awareness as unknown as Provider["awareness"];
    this.ws.on("sync", (isSynced: boolean) => {
      if (isSynced) this.markReady();
    });
  }

  private markReady() {
    clearTimeout(this.offlineTimer);
    if (!this.reportedSync) {
      this.reportedSync = true;
      this.onReady?.();
    }
  }

  connect() {
    this.active = true;
    if (this.seed.kind === "yjs") {
      Y.applyUpdate(this.doc, decodeDocState(this.seed.state), LOAD_ORIGIN);
      // Applied once; a reconnect (React StrictMode) needs nothing more.
      this.seed = { kind: "empty" };
    }
    clearTimeout(this.offlineTimer);
    if (this.live) this.ws.connect();
    this.offlineTimer = setTimeout(
      () => {
        if (this.ws.synced) return;
        this.markReady();
        for (const listener of this.syncListeners) listener(true);
      },
      this.live ? OFFLINE_AFTER_MS : 0,
    );
  }

  disconnect() {
    this.active = false;
    clearTimeout(this.offlineTimer);
    this.ws.disconnect();
  }

  destroy() {
    clearTimeout(this.offlineTimer);
    this.ws.destroy();
  }

  on(type: string, callback: (...args: never[]) => void) {
    if (type === "sync") this.syncListeners.add(callback as SyncListener);
    this.ws.on(type as "sync", callback as SyncListener);
  }

  off(type: string, callback: (...args: never[]) => void) {
    if (type === "sync") this.syncListeners.delete(callback as SyncListener);
    this.ws.off(type as "sync", callback as SyncListener);
  }
}

function liveServer(
  collaboration: CollaborationAdapter | undefined,
  identity: DocumentIdentity,
  room: string,
) {
  if (!collaboration) return null;
  return {
    url: collaboration.url,
    WebSocketPolyfill: collaboration.webSocketFor?.({
      ...identity,
      documentKey: identity.documentKey ?? "main",
      room,
    }),
  };
}

export function DocumentCollaboration({
  doc,
  identity,
  roomId,
  revision,
  seed,
  user,
  providerRef,
  onReady,
}: {
  doc: Y.Doc;
  /** The document, for authorising its room. */
  identity: DocumentIdentity;
  roomId: string;
  /** The saved revision the document loaded at (part of the room name). */
  revision: number;
  seed: DocumentSeed;
  user: CollaborationUser;
  /** Receives the provider, for saving (remote updates) and presence. */
  providerRef: { current: DocumentProvider | null };
  onReady: () => void;
}) {
  const { collaboration } = useEditorAdapters();
  const onReadyRef = useRef(onReady);
  // The seed, server and document are read once, when the room is first joined.
  const seedRef = useRef(seed);
  const joinRef = useRef({ collaboration, identity });
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  const providerFactory = useCallback(
    (id: string, yjsDocMap: Map<string, Y.Doc>) => {
      yjsDocMap.set(id, doc);
      const room = documentRoomName(roomId, revision);
      const { collaboration, identity } = joinRef.current;
      const provider = new DocumentProvider(
        doc,
        room,
        seedRef.current,
        liveServer(collaboration, identity, room),
      );
      provider.onReady = () => onReadyRef.current();
      providerRef.current = provider;
      return provider as unknown as Provider;
    },
    [doc, providerRef, revision, roomId],
  );

  // Released when the editor goes away. React's dev-mode double mount runs
  // this cleanup and mounts again at once; the provider may not have
  // reconnected by the next tick (the plugin connects on a later render), so
  // what tells a real unmount apart is whether this component mounted again.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const provider = providerRef.current;
      setTimeout(() => {
        if (mountedRef.current || !provider) return;
        provider.destroy();
        if (providerRef.current === provider) providerRef.current = null;
      });
    };
  }, [providerRef]);

  // Read once, like the room's seed.
  const [initialEditorState] = useState(() => {
    if (seed.kind !== "html") return undefined;
    const { html } = seed;
    return (_editor: LexicalEditor) => $replaceWithHtml(html);
  });

  const awarenessData = useMemo(() => ({ id: user.id, avatarUrl: user.avatarUrl }), [user.id, user.avatarUrl]);

  return (
    <CollaborationPlugin
      id={DOCUMENT_DOC_ID}
      providerFactory={providerFactory}
      shouldBootstrap
      initialEditorState={initialEditorState}
      username={user.name}
      cursorColor={user.color}
      awarenessData={awarenessData}
    />
  );
}
