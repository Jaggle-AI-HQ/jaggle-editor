import { useMemo, useState } from "react";

import {
  type DocumentSaveStatus,
  EditorProvider,
  LexicalEditor,
  type StoredDocument,
} from "@jaggle-ai-hq/editor";
import { Toaster } from "sonner";

import { createAdapters, PEOPLE } from "./adapters";

const TABS = ["document", "comments", "read-only", "no backend"] as const;
type Tab = (typeof TABS)[number];

const WORKSPACE_ID = "playground";
const SOURCE = {
  entityType: "task",
  entityId: "demo-task",
  roomId: `${WORKSPACE_ID}:task-demo-task`,
};

const params = new URLSearchParams(window.location.search);

function savedHtml() {
  try {
    const raw = localStorage.getItem("playground:doc:task:demo-task:main");
    return raw ? (JSON.parse(raw) as StoredDocument).html : "";
  } catch {
    return "";
  }
}

export function App() {
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "document");
  const [dark, setDark] = useState(params.get("theme") === "dark");
  const [status, setStatus] = useState<DocumentSaveStatus>("idle");
  const [comments, setComments] = useState<string[]>([]);
  const person = PEOPLE.find((candidate) => candidate.id === params.get("user")) ?? PEOPLE[0];
  const collaborationUrl = params.get("collab") === "1" ? "ws://localhost:1234" : undefined;

  const adapters = useMemo(
    () =>
      createAdapters({
        user: { id: person.id, name: person.name },
        collaborationUrl,
      }),
    [collaborationUrl, person.id, person.name],
  );

  const toggleDark = () => {
    setDark((current) => {
      document.documentElement.classList.toggle("dark", !current);
      return !current;
    });
  };
  if (dark !== document.documentElement.classList.contains("dark")) {
    document.documentElement.classList.toggle("dark", dark);
  }

  return (
    <EditorProvider adapters={adapters}>
      <div className="flex min-h-screen flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          <strong className="me-2">@jaggle-ai-hq/editor</strong>
          <nav className="flex gap-1" aria-label="Examples">
            {TABS.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={tab === name}
                onClick={() => setTab(name)}
                className="rounded-md px-2.5 py-1 capitalize hover:bg-accent aria-pressed:bg-accent aria-pressed:font-medium"
              >
                {name}
              </button>
            ))}
          </nav>
          <span className="ms-auto text-xs text-muted-foreground">
            {person.name} · {collaborationUrl ? "live room on :1234" : "editing alone"}
            {tab === "document" ? ` · ${status}` : null}
          </span>
          <button type="button" onClick={toggleDark} className="rounded-md border px-2 py-1 text-xs">
            {dark ? "Light" : "Dark"}
          </button>
        </header>

        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-4">
          {tab === "document" ? (
            <div className="flex h-[calc(100vh-7rem)] flex-col rounded-xl border">
              <LexicalEditor
                mode="document"
                page
                source={SOURCE}
                workspaceId={WORKSPACE_ID}
                mentionScope={{ type: "workspace", id: WORKSPACE_ID }}
                imageScope={{ entityType: "task", entityId: "demo-task" }}
                title="Playground document"
                showComments
                showVersionHistory
                showImport
                showExport
                onSaveStatusChange={setStatus}
                header={{ start: <span className="font-medium">Playground document</span> }}
              />
            </div>
          ) : null}

          {tab === "comments" ? (
            <section className="flex flex-col gap-3">
              {comments.map((html, index) => (
                <div key={index} className="rounded-lg border p-3">
                  <LexicalEditor mode="comment" readOnly html={html} />
                </div>
              ))}
              <LexicalEditor
                mode="comment"
                workspaceId={WORKSPACE_ID}
                mentionScope={{ type: "workspace", id: WORKSPACE_ID }}
                imageScope={{ entityType: "task", entityId: "demo-task" }}
                actionLabel="Comment"
                onComment={(_state, html) => setComments((current) => [...current, html])}
              />
            </section>
          ) : null}

          {tab === "read-only" ? (
            <section className="rounded-xl border p-6">
              <LexicalEditor mode="document" readOnly html={savedHtml() || "<p>Nothing saved yet.</p>"} />
            </section>
          ) : null}

          {tab === "no backend" ? (
            <EditorProvider adapters={{ currentUser: { id: "guest", name: "Guest" } }}>
              <div className="rounded-xl border">
                <LexicalEditor
                  mode="document"
                  html="<p>No adapters here: plain editing, with comments kept in the page.</p>"
                  showComments
                  showVersionHistory
                  showExport
                />
              </div>
            </EditorProvider>
          ) : null}
        </main>
      </div>
      <Toaster richColors theme={dark ? "dark" : "light"} />
    </EditorProvider>
  );
}
