"use client";

import {
  Cancel01Icon,
  File01Icon,
  MusicNote01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";

import { EDITOR_QUERY_KEY, useFileUrlResolver } from "../../adapters/context";
import { Button } from "../../ui/button";
import { getAttachmentIdFromReference } from "../../lib/file-url";
import { cn } from "../../lib/utils";

import type { CommentAttachment } from "./attachment-content";

function formatSize(size?: number) {
  if (size === undefined) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function CommentAttachmentPreview({
  attachment,
  onRemove,
  progress,
}: {
  attachment: CommentAttachment;
  /** While uploading: × cancels the upload. */
  onRemove?: () => void;
  /** Set while the file uploads (0–1): the card fades and shows the progress. */
  progress?: number;
}) {
  const uploading = progress !== undefined;
  const percent = Math.round((progress ?? 0) * 100);
  const isReference = Boolean(getAttachmentIdFromReference(attachment.src));
  const isVisual = attachment.kind === "image" || attachment.kind === "video";
  const resolveUrl = useFileUrlResolver();
  const resolved = useQuery({
    queryKey: [EDITOR_QUERY_KEY, "inline-file", attachment.src],
    queryFn: () => resolveUrl(attachment.src),
    enabled: isReference && isVisual,
    staleTime: 60_000,
  });
  const previewUrl = isReference ? resolved.data : attachment.src;
  const sizeLabel = formatSize(attachment.size);

  return (
    <div className="px-4 pb-2">
      <div
        aria-busy={uploading}
        className="relative flex max-w-sm min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-border bg-muted/40 p-2"
      >
        <div
          className={cn(
            "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground",
            uploading && "opacity-50",
          )}
        >
          {isVisual && previewUrl ? (
            attachment.kind === "image" ? (
              <img
                src={previewUrl}
                alt=""
                width={56}
                height={56}
                className="size-full object-cover"
              />
            ) : (
              <video
                src={previewUrl}
                muted
                playsInline
                preload="metadata"
                aria-hidden="true"
                className="size-full object-cover"
              />
            )
          ) : (
            <HugeiconsIcon
              icon={attachment.kind === "audio" ? MusicNote01Icon : File01Icon}
              size={24}
              aria-hidden="true"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" title={attachment.name}>
            {attachment.name}
          </p>
          {uploading ? (
            <p role="status" className="text-xs text-muted-foreground tabular-nums">
              Uploading… {percent}%
            </p>
          ) : (
            <p className="text-xs capitalize text-muted-foreground">
              {attachment.kind}
              {sizeLabel ? ` · ${sizeLabel}` : ""}
            </p>
          )}
        </div>
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={uploading ? `Cancel uploading ${attachment.name}` : `Remove ${attachment.name}`}
            title={uploading ? "Cancel upload" : undefined}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onRemove}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} aria-hidden="true" />
          </Button>
        ) : null}
        {uploading ? (
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground/10">
            <span
              className="block h-full bg-primary transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </span>
        ) : null}
      </div>
    </div>
  );
}
