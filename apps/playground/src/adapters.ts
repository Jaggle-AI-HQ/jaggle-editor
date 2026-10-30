import type {
  DocumentIdentity,
  EditorAdapters,
  EditorPerson,
  EditorThread,
  EditorUser,
  EditorVersion,
  StoredDocument,
} from "@jaggle-ai/editor";
import { toast } from "sonner";

/**
 * Stand-ins for an app's backend. Documents, versions and uploads persist in
 * this browser (localStorage), so reloading shows what was saved. Calls are
 * logged as `[adapter] …` to follow along.
 */

// eslint-disable-next-line no-console -- the playground shows what each adapter is asked for
const log = (...args: unknown[]) => console.info("[adapter]", ...args);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const PEOPLE: EditorPerson[] = [
  { id: "ada", name: "Ada Lovelace", email: "ada@example.com" },
  { id: "grace", name: "Grace Hopper", email: "grace@example.com" },
  { id: "alan", name: "Alan Turing", email: "alan@example.com" },
  { id: "katherine", name: "Katherine Johnson", email: "katherine@example.com" },
  { id: "linus", name: "Linus Torvalds", email: "linus@example.com" },
];

const keyOf = ({ entityType, entityId, documentKey }: DocumentIdentity) =>
  `${entityType}:${entityId}:${documentKey ?? "main"}`;

function readStore<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`playground:${name}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStore(name: string, value: unknown) {
  try {
    localStorage.setItem(`playground:${name}`, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the session still works.
  }
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const threads = new Map<string, EditorThread[]>();
const readStates = new Map<string, string>();

const AI_REPLY = `## A short summary

The editor now lives in **@jaggle-ai/editor**, so both apps share it:

- Jaggle AI keeps its documents, comments and versions.
- Jaggle Office can add rich text where it has plain text today.

> Each app plugs in its own backend through adapters.`;

export function createAdapters({
  user,
  collaborationUrl,
}: {
  user: EditorUser;
  collaborationUrl?: string;
}): EditorAdapters {
  return {
    currentUser: user,
    notify: toast,
    people: {
      search: async (scope, search) => {
        log("people.search", scope, search);
        const term = search.toLowerCase();
        return PEOPLE.filter((person) => person.name.toLowerCase().includes(term));
      },
      get: async (id) => PEOPLE.find((person) => person.id === id) ?? null,
    },
    files: {
      upload: async (file, scope, { onProgress, signal }) => {
        log("files.upload", file.name, scope);
        for (let step = 1; step <= 5; step++) {
          signal?.throwIfAborted();
          await wait(120);
          onProgress?.(step / 5);
        }
        const attachmentId = crypto.randomUUID();
        writeStore(`upload:${attachmentId}`, await readDataUrl(file));
        return { attachmentId };
      },
      resolveUrl: async (src) => {
        const id = decodeURIComponent(src.replace("jaggle-file://attachment/", ""));
        return readStore<string | null>(`upload:${id}`, null) ?? src;
      },
      rawUrl: async (attachmentId) => readStore(`upload:${attachmentId}`, ""),
    },
    documents: {
      load: async (identity) => {
        log("documents.load", keyOf(identity));
        await wait(150);
        return readStore<StoredDocument>(`doc:${keyOf(identity)}`, { yjsState: null, html: "" });
      },
      save: async (identity, document) => {
        log("documents.save", keyOf(identity), `${document.html.length} chars of HTML`);
        const revision = document.revision ?? 0;
        writeStore(`doc:${keyOf(identity)}`, { ...document, revision });
        return { revision };
      },
    },
    threads: {
      list: async (identity) => threads.get(keyOf(identity)) ?? [],
      create: async (identity, thread) => log("threads.create", keyOf(identity), thread),
      addComment: async (_identity, threadId, comment) => log("threads.addComment", threadId, comment.id),
      updateComment: async (_identity, threadId, commentId) => log("threads.updateComment", threadId, commentId),
      deleteComment: async (_identity, threadId, commentId) => log("threads.deleteComment", threadId, commentId),
      deleteThread: async (_identity, threadId) => log("threads.deleteThread", threadId),
      setResolved: async (_identity, threadId, resolved) => log("threads.setResolved", threadId, resolved),
      addReaction: async (_identity, threadId, commentId, emoji) => log("threads.addReaction", threadId, commentId, emoji),
      removeReaction: async (_identity, threadId, commentId, emoji) =>
        log("threads.removeReaction", threadId, commentId, emoji),
      getReadState: async (identity) => readStates.get(keyOf(identity)) ?? null,
      saveReadState: async (identity, lastReadAt) => readStates.set(keyOf(identity), lastReadAt),
    },
    versions: {
      list: async (identity) =>
        readStore<EditorVersion[]>(`versions:${keyOf(identity)}`, [])
          .map(({ snapshotState: _state, html: _html, ...summary }) => summary)
          .reverse(),
      get: async (identity, versionId) => {
        const found = readStore<EditorVersion[]>(`versions:${keyOf(identity)}`, []).find(
          (version) => version.id === versionId,
        );
        if (!found) throw new Error("That version is gone.");
        return found;
      },
      create: async (identity, version) => {
        log("versions.create", keyOf(identity), version.name ?? "(automatic)");
        const all = readStore<EditorVersion[]>(`versions:${keyOf(identity)}`, []);
        all.push({
          id: crypto.randomUUID(),
          number: all.length + 1,
          name: version.name ?? null,
          auto: version.auto,
          createdAt: new Date().toISOString(),
          author: { id: user.id, name: user.name },
          stateFormat: "lexical",
          snapshotState: version.state,
          html: version.html,
        });
        writeStore(`versions:${keyOf(identity)}`, all);
      },
      rename: async (identity, versionId, name) => {
        const all = readStore<EditorVersion[]>(`versions:${keyOf(identity)}`, []);
        writeStore(
          `versions:${keyOf(identity)}`,
          all.map((version) => (version.id === versionId ? { ...version, name } : version)),
        );
      },
    },
    ai: {
      stream: async (request, { signal, onText }) => {
        log("ai.stream", request.actionKey, request.mode);
        let text = "";
        for (const word of AI_REPLY.split(/(\s+)/)) {
          signal.throwIfAborted();
          await wait(25);
          text += word;
          onText(text);
        }
        return text;
      },
    },
    exporter: {
      // A real app renders PDF/Word on its server; this hands back the HTML it would send.
      render: async (format, html) => {
        log("exporter.render", format, `${html.length} chars`);
        return new Blob([html], { type: "text/html" });
      },
    },
    importer: {
      pdfToHtml: async (file, scope, { onProcessing }) => {
        log("importer.pdfToHtml", file.name, scope);
        onProcessing?.();
        await wait(400);
        return `<h1>${file.name}</h1><p>A real app converts the PDF on its server.</p>`;
      },
    },
    collaboration: collaborationUrl ? { url: collaborationUrl } : undefined,
  };
}
