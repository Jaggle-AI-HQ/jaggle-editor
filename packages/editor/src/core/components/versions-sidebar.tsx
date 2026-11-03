"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import {
  ChevronRight,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";

import { EDITOR_QUERY_KEY, useEditorAdapters } from "../../adapters/context";
import { Loader } from "../../ui/loader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { cn } from "../../lib/utils";

import { DOCUMENT_LAYOUT } from "../document/layout";
import type { DocumentSource } from "../lib/types";

import { HtmlView } from "./html-view";
import { SidePanelEmpty, SidePanelFilter, SidePanelHeader } from "./side-panel";

export type PreviewVersion = {
  id: string;
  name: string;
  createdAt: number;
  auto: boolean;
  /** The version's HTML; null while it isn't loaded (saved documents load it when opened). */
  html: string | null;
  /** Who saved it. */
  author?: string;
  authorId?: string;
};

const STARTER: PreviewVersion[] = [
  {
    id: "manual-1",
    name: "Version #1",
    createdAt: Date.now() - 1000 * 60 * 60 * 26,
    auto: false,
    html: "<p>Named snapshot of this page.</p>",
  },
  {
    id: "auto-1",
    name: "Autosave",
    createdAt: Date.now() - 1000 * 60 * 12,
    auto: true,
    html: "<p>Autosave from earlier on this page.</p>",
  },
];

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(time: number) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function dayLabel(time: number) {
  const today = startOfDay(Date.now());
  const day = startOfDay(time);
  if (day === today) return "Today";
  if (day === today - DAY) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: new Date(time).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(time);
}

function timeOfDay(time: number) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(time);
}

/** "Today, 2:14 PM" style, for the preview bar and dialogs. */
export function versionWhen(version: PreviewVersion) {
  return `${dayLabel(version.createdAt)}, ${timeOfDay(version.createdAt)}`;
}

export function usePreviewVersions() {
  const [versions, setVersions] = useState<PreviewVersion[]>(STARTER);

  const save = (name: string) => {
    setVersions((current) => [
      {
        id: crypto.randomUUID(),
        name,
        createdAt: Date.now(),
        auto: false,
        html: "<p>Saved from the version history on this page.</p>",
        author: "You",
      },
      ...current,
    ]);
  };

  const rename = (id: string, name: string) => {
    setVersions((current) =>
      current.map((version) => (version.id === id ? { ...version, name } : version)),
    );
  };

  const restore = (version: PreviewVersion) => {
    setVersions((current) => [
      {
        id: crypto.randomUUID(),
        name: `Restored from ${version.name}`,
        createdAt: Date.now(),
        auto: false,
        html: version.html,
      },
      ...current,
    ]);
  };

  return { versions, save, rename, restore };
}

/** Confirms restoring a version; shared by the list and the preview bar. */
export function RestoreVersionDialog({
  version,
  onCancel,
  onConfirm,
}: {
  version: PreviewVersion | null;
  onCancel: () => void;
  onConfirm: (version: PreviewVersion) => void;
}) {
  return (
    <AlertDialog open={version !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore this version?</AlertDialogTitle>
          <AlertDialogDescription>
            The document goes back to {version?.name} ({version ? versionWhen(version) : ""}).
            The current content is kept as a version, so you can switch back.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => version && onConfirm(version)}>
            Restore
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The bar above a version shown in place of the document. */
export function VersionPreviewBar({
  version,
  onBack,
  onRestore,
}: {
  version: PreviewVersion;
  onBack: () => void;
  onRestore: () => void;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 border-b bg-muted/60 px-4 py-1.5">
      <History className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 truncate">
        <span className="text-muted-foreground">Viewing </span>
        <span className="font-medium">{version.name}</span>
        <span className="text-muted-foreground"> · {versionWhen(version)}</span>
      </p>
      <Button type="button" size="sm" variant="ghost" onClick={onBack}>
        Back to current
      </Button>
      <Button type="button" size="sm" onClick={onRestore}>
        <RotateCcw />
        Restore
      </Button>
    </div>
  );
}

/**
 * A version's content, read-only, in the writing column. A saved document's
 * versions are loaded (their stored HTML) when opened.
 */
export function VersionPreviewContent({
  version,
  source,
}: {
  version: PreviewVersion;
  source?: DocumentSource;
}) {
  const { versions } = useEditorAdapters();
  const identity = {
    entityType: source?.entityType ?? "",
    entityId: source?.entityId ?? "",
    documentKey: source?.documentKey ?? "main",
  };
  const loaded = useQuery({
    queryKey: [
      EDITOR_QUERY_KEY,
      "version",
      identity.entityType,
      identity.entityId,
      identity.documentKey,
      version.id,
    ],
    queryFn: () => versions!.get(identity, version.id),
    enabled: Boolean(versions && source?.entityId && version.html === null),
  });
  const html = version.html ?? loaded.data?.html ?? null;
  let body;
  if (html !== null) {
    body = <HtmlView html={html} />;
  } else if (loaded.isPending) {
    body = <Loader />;
  } else {
    body = (
      <p className="py-8 text-center text-muted-foreground">This version couldn&apos;t be loaded.</p>
    );
  }
  return (
    <div className={DOCUMENT_LAYOUT.pageColumn}>
      <div className={DOCUMENT_LAYOUT.contentInset}>{body}</div>
    </div>
  );
}

function TimelineDot({ variant }: { variant: "current" | "manual" | "auto" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute start-[5px] top-[15px] z-10 size-2.5 rounded-full border-2 bg-background",
        variant === "current" && "border-primary bg-primary ring-4 ring-primary/15",
        variant === "manual" && "border-primary",
        variant === "auto" && "start-[6px] top-[16px] size-2 border-muted-foreground/40",
      )}
    />
  );
}

/** "Sangay Wangchuk", or "Ana, Bo +2" when several people saved. */
export function authorsLabel(versions: PreviewVersion[]) {
  const names = [...new Set(versions.map((version) => version.author).filter(Boolean))];
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

function VersionActions({
  version,
  onRename,
  onRestore,
}: {
  version: PreviewVersion;
  onRename: () => void;
  onRestore: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 shrink-0 text-muted-foreground opacity-0 group-hover/version:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          aria-label={`Actions for ${version.name}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onRename}>
          <Pencil />
          {version.auto ? "Name this version" : "Rename"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onRestore}>
          <RotateCcw />
          Restore
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VersionRow({
  version,
  selected,
  nested = false,
  onSelect,
  onRename,
  onRestore,
}: {
  version: PreviewVersion;
  selected: boolean;
  /** Inside an autosave group: one line, no dot. */
  nested?: boolean;
  onSelect: () => void;
  onRename: () => void;
  onRestore: () => void;
}) {
  const when = timeOfDay(version.createdAt);
  return (
    <li className="group/version relative">
      {nested ? null : <TimelineDot variant={version.auto ? "auto" : "manual"} />}
      <div
        className={cn(
          "ms-5 flex items-center gap-1 rounded-lg pe-1 transition-colors hover:bg-muted/70",
          nested && "ms-8",
          selected && "bg-muted hover:bg-muted",
        )}
      >
        <button
          type="button"
          aria-current={selected ? "true" : undefined}
          className={cn(
            "min-w-0 flex-1 rounded-lg px-2 text-start outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
            nested ? "py-1" : "py-1.5",
          )}
          onClick={onSelect}
        >
          {nested ? (
            <span className="flex min-w-0 items-baseline gap-2">
              <span className={cn("shrink-0 text-sm tabular-nums", selected && "font-medium")}>
                {when}
              </span>
              {version.author ? (
                <span className="truncate text-xs text-muted-foreground">{version.author}</span>
              ) : null}
            </span>
          ) : (
            <>
              <span
                className={cn(
                  "block truncate text-sm",
                  version.auto ? "text-muted-foreground" : "font-medium",
                  selected && "text-foreground",
                )}
              >
                {version.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {version.author ? `${when} · ${version.author}` : when}
              </span>
            </>
          )}
        </button>
        <VersionActions version={version} onRename={onRename} onRestore={onRestore} />
      </div>
    </li>
  );
}

/** Autosaves in a row, folded into one entry that opens to list them. */
function AutosaveGroup({
  versions,
  previewId,
  onPreview,
  onRename,
  onRestore,
}: {
  versions: PreviewVersion[];
  previewId: string | null;
  onPreview: (id: string) => void;
  onRename: (version: PreviewVersion) => void;
  onRestore: (version: PreviewVersion) => void;
}) {
  const holdsPreview = versions.some((version) => version.id === previewId);
  const [open, setOpen] = useState(holdsPreview);
  const newest = versions[0];
  const oldest = versions[versions.length - 1];
  const span =
    timeOfDay(oldest.createdAt) === timeOfDay(newest.createdAt)
      ? timeOfDay(newest.createdAt)
      : `${timeOfDay(oldest.createdAt)} – ${timeOfDay(newest.createdAt)}`;
  const authors = authorsLabel(versions);
  const expanded = open || holdsPreview;

  return (
    <li className="relative">
      <TimelineDot variant="auto" />
      <button
        type="button"
        aria-expanded={expanded}
        className="ms-5 flex w-[calc(100%-1.25rem)] items-center gap-2 rounded-lg px-2 py-1.5 text-start transition-colors outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-primary/20"
        onClick={() => setOpen(!expanded)}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-muted-foreground">
            {versions.length} autosaves
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {authors ? `${span} · ${authors}` : span}
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform rtl:rotate-180",
            expanded && "rotate-90 rtl:rotate-90",
          )}
        />
      </button>
      {expanded ? (
        <ul className="mt-0.5 space-y-px">
          {versions.map((version) => (
            <VersionRow
              key={version.id}
              version={version}
              nested
              selected={previewId === version.id}
              onSelect={() => onPreview(version.id)}
              onRename={() => onRename(version)}
              onRestore={() => onRestore(version)}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export type VersionEntry =
  | { type: "version"; version: PreviewVersion }
  | { type: "autosaves"; versions: PreviewVersion[] };

/** A day's versions, with autosaves in a row folded together. */
export function dayEntries(versions: PreviewVersion[]): VersionEntry[] {
  const entries: VersionEntry[] = [];
  for (const version of versions) {
    const last = entries.at(-1);
    if (version.auto && last?.type === "autosaves") {
      last.versions.push(version);
    } else if (version.auto) {
      entries.push({ type: "autosaves", versions: [version] });
    } else {
      entries.push({ type: "version", version });
    }
  }
  return entries;
}

type VersionFilter = "all" | "named";

/**
 * Version history: a timeline grouped by day, newest first, under "Current
 * version". Choosing a version previews it in place of the document (the
 * caller renders `VersionPreviewBar` and `VersionPreviewContent`).
 */
export function VersionsSidebar({
  versions,
  previewId,
  onPreview,
  onSave,
  onRename,
  onRequestRestore,
  onClose,
}: {
  versions: PreviewVersion[];
  previewId: string | null;
  onPreview: (id: string | null) => void;
  onSave: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRequestRestore: (version: PreviewVersion) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<VersionFilter>("all");
  const [naming, setNaming] = useState<{
    mode: "create" | "rename";
    id?: string;
    name: string;
    /** Naming an autosave rather than renaming a named version. */
    auto?: boolean;
  } | null>(null);
  const namedCount = versions.filter((version) => !version.auto).length;
  const visible = versions
    .filter((version) => filter === "all" || !version.auto)
    .toSorted((a, b) => b.createdAt - a.createdAt);
  const groups: { label: string; versions: PreviewVersion[] }[] = [];
  for (const version of visible) {
    const label = dayLabel(version.createdAt);
    const group = groups.at(-1);
    if (group?.label === label) {
      group.versions.push(version);
    } else {
      groups.push({ label, versions: [version] });
    }
  }
  const nextNumber = namedCount + 1;

  const submitName = () => {
    if (!naming?.name.trim()) return;
    if (naming.mode === "rename" && naming.id) {
      onRename(naming.id, naming.name.trim());
    } else {
      onSave(naming.name.trim());
    }
    setNaming(null);
  };
  const rename = (version: PreviewVersion) =>
    setNaming({
      mode: "rename",
      id: version.id,
      name: version.auto ? `Version #${nextNumber}` : version.name,
      auto: version.auto,
    });

  return (
    <aside className={DOCUMENT_LAYOUT.sidePanel} aria-label="Version history">
      <SidePanelHeader title="Version history">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="me-1 h-7 gap-1 px-2 text-xs"
          onClick={() => setNaming({ mode: "create", name: `Version #${nextNumber}` })}
        >
          <Plus className="size-3.5" />
          Save version
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 text-muted-foreground"
          aria-label="Close version history"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </SidePanelHeader>
      <SidePanelFilter
        label="Show versions"
        value={filter}
        options={[
          { value: "all", label: "All versions", count: versions.length },
          { value: "named", label: "Named", count: namedCount },
        ]}
        onChange={(next) => {
          setFilter(next);
          // An autosave being previewed leaves the list, so the preview ends too.
          if (next === "named" && versions.some((version) => version.id === previewId && version.auto)) {
            onPreview(null);
          }
        }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {/* The timeline line runs behind the dots. */}
        <div className="relative pt-2 before:absolute before:start-[9px] before:top-5 before:bottom-4 before:w-px before:bg-border">
          <ul>
            <li className="relative">
              <TimelineDot variant="current" />
              <button
                type="button"
                aria-current={previewId === null ? "true" : undefined}
                className={cn(
                  "ms-5 block w-[calc(100%-1.25rem)] rounded-lg px-2 py-1.5 text-start transition-colors outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-primary/20",
                  previewId === null && "bg-muted hover:bg-muted",
                )}
                onClick={() => onPreview(null)}
              >
                <span className="block text-sm font-medium">
                  Current version
                </span>
                <span className="block text-xs text-muted-foreground">Live document</span>
              </button>
            </li>
          </ul>
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <p className="sticky top-0 z-20 ms-7 mt-2 bg-background/95 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase backdrop-blur-sm">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {dayEntries(group.versions).map((entry) =>
                  entry.type === "version" || entry.versions.length === 1 ? (
                    <VersionRow
                      key={entry.type === "version" ? entry.version.id : entry.versions[0].id}
                      version={entry.type === "version" ? entry.version : entry.versions[0]}
                      selected={
                        previewId ===
                        (entry.type === "version" ? entry.version.id : entry.versions[0].id)
                      }
                      onSelect={() =>
                        onPreview(entry.type === "version" ? entry.version.id : entry.versions[0].id)
                      }
                      onRename={() =>
                        rename(entry.type === "version" ? entry.version : entry.versions[0])
                      }
                      onRestore={() =>
                        onRequestRestore(entry.type === "version" ? entry.version : entry.versions[0])
                      }
                    />
                  ) : (
                    <AutosaveGroup
                      key={entry.versions[0].id}
                      versions={entry.versions}
                      previewId={previewId}
                      onPreview={onPreview}
                      onRename={rename}
                      onRestore={onRequestRestore}
                    />
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
        {visible.length === 0 ? (
          <SidePanelEmpty
            icon={<History />}
            title={versions.length > 0 ? "No named versions" : "No versions yet"}
            description={
              versions.length > 0
                ? "Name a version to find it here, or switch to All versions to see autosaves."
                : "Save a version to start tracking changes."
            }
            action={
              versions.length > 0
                ? { label: "Show all versions", onClick: () => setFilter("all") }
                : undefined
            }
          />
        ) : null}
      </div>

      <Dialog open={naming !== null} onOpenChange={(open) => !open && setNaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {naming?.mode !== "rename"
                ? "Save version"
                : naming.auto
                  ? "Name version"
                  : "Rename version"}
            </DialogTitle>
            <DialogDescription>
              {naming?.mode === "rename" && !naming.auto
                ? "Enter a new name for this version."
                : "Give this version a name to find it later."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-2">
            <Label htmlFor="version-name">Version name</Label>
            <Input
              id="version-name"
              value={naming?.name ?? ""}
              onChange={(event) =>
                setNaming((current) =>
                  current ? { ...current, name: event.target.value } : current,
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") submitName();
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNaming(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={!naming?.name.trim()} onClick={submitName}>
              {naming?.mode === "rename" && !naming.auto ? "Rename" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
