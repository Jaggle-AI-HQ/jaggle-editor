"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { FilterHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { History, MoreHorizontal, Pencil, Plus, RotateCcw, X } from "lucide-react";

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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../ui/tooltip";
import { cn } from "../../lib/utils";

import { DOCUMENT_LAYOUT } from "../document/layout";
import type { DocumentSource } from "../lib/types";

import { HtmlView } from "./html-view";

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
        "absolute start-[5px] top-[13px] z-10 size-2.5 rounded-full border-2 bg-background",
        variant === "current" && "border-primary bg-primary",
        variant === "manual" && "border-primary",
        variant === "auto" && "border-muted-foreground/40",
      )}
    />
  );
}

function VersionRow({
  version,
  selected,
  onSelect,
  onRename,
  onRestore,
}: {
  version: PreviewVersion;
  selected: boolean;
  onSelect: () => void;
  onRename: () => void;
  onRestore: () => void;
}) {
  return (
    <li className="group relative">
      <TimelineDot variant={version.auto ? "auto" : "manual"} />
      <div
        className={cn(
          "ms-5 flex items-center gap-1 rounded-md pe-1 transition-colors hover:bg-muted/60",
          selected && "bg-accent hover:bg-accent",
        )}
      >
        <button
          type="button"
          aria-current={selected ? "true" : undefined}
          className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          onClick={onSelect}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn("truncate", version.auto ? "text-muted-foreground" : "font-medium")}>
              {version.name}
            </span>
          </span>
          <span className="block text-sm text-muted-foreground">
            {version.author
              ? `${version.author} · ${timeOfDay(version.createdAt)}`
              : timeOfDay(version.createdAt)}
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              aria-label={`Actions for ${version.name}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onRename}>
              <Pencil />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onRestore}>
              <RotateCcw />
              Restore
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

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
  const [showAutosaves, setShowAutosaves] = useState(true);
  const [naming, setNaming] = useState<{
    mode: "create" | "rename";
    id?: string;
    name: string;
  } | null>(null);
  const visible = versions
    .filter((version) => showAutosaves || !version.auto)
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
  const nextNumber = versions.filter((version) => !version.auto).length + 1;

  const submitName = () => {
    if (!naming?.name.trim()) return;
    if (naming.mode === "rename" && naming.id) {
      onRename(naming.id, naming.name.trim());
    } else {
      onSave(naming.name.trim());
    }
    setNaming(null);
  };

  return (
    <aside className={DOCUMENT_LAYOUT.sidePanel} aria-label="Version history">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b ps-3.5 pe-2">
        <p className="font-medium">Version history</p>
        <div className="ms-auto flex items-center gap-0.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-1.5 text-muted-foreground"
            onClick={() => setNaming({ mode: "create", name: `Version #${nextNumber}` })}
          >
            <Plus className="size-3.5" />
            Save
          </Button>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "size-6 text-muted-foreground",
                      !showAutosaves && "text-primary",
                    )}
                    aria-label="Filter versions"
                  >
                    <HugeiconsIcon
                      icon={FilterHorizontalIcon}
                      strokeWidth={2}
                      className="size-3.5"
                    />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Filter</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuCheckboxItem
                checked={showAutosaves}
                onCheckedChange={setShowAutosaves}
              >
                Show autosaves
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-6 text-muted-foreground"
            aria-label="Close version history"
            onClick={onClose}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {/* The timeline line runs behind the dots. */}
        <div className="relative before:absolute before:start-[9px] before:top-4 before:bottom-4 before:w-px before:bg-border">
          <ul>
            <li className="relative">
              <TimelineDot variant="current" />
              <button
                type="button"
                aria-current={previewId === null ? "true" : undefined}
                className={cn(
                  "ms-5 block w-[calc(100%-1.25rem)] rounded-md px-2 py-1.5 text-start transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary/20",
                  previewId === null && "bg-accent hover:bg-accent",
                )}
                onClick={() => onPreview(null)}
              >
                <span className="block font-medium">Current version</span>
                <span className="block text-sm text-muted-foreground">Live document</span>
              </button>
            </li>
          </ul>
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <p className="ms-7 mt-3 mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.versions.map((version) => (
                  <VersionRow
                    key={version.id}
                    version={version}
                    selected={previewId === version.id}
                    onSelect={() => onPreview(version.id)}
                    onRename={() =>
                      setNaming({ mode: "rename", id: version.id, name: version.name })
                    }
                    onRestore={() => onRequestRestore(version)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="px-6 py-10 text-center text-muted-foreground">
            {versions.length > 0
              ? "No saved versions. Show autosaves from the filter menu to see automatic snapshots."
              : "Save a version to start tracking changes."}
          </p>
        ) : null}
      </div>

      <Dialog open={naming !== null} onOpenChange={(open) => !open && setNaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {naming?.mode === "rename" ? "Rename version" : "Save version"}
            </DialogTitle>
            <DialogDescription>
              {naming?.mode === "rename"
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
              {naming?.mode === "rename" ? "Rename" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
