"use client";

import {
  Cancel01Icon,
  File01Icon,
  MusicNote01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, type NodeKey } from "lexical";

import { Button } from "../../ui/button";
import { cn } from "../../lib/utils";

import { useTranslation } from "../lib/locale";
import { type NodeUpload, useUploadRegistry } from "../lib/upload-registry";

/** The local file as the block will look, before it is stored. */
function UploadPreview({ upload }: { upload: NodeUpload }) {
  if (upload.kind === "image") {
    return (
      <img
        src={upload.previewUrl}
        alt=""
        width={1200}
        height={800}
        draggable={false}
        className="block h-auto w-full max-w-full rounded-md select-none"
      />
    );
  }
  if (upload.kind === "video") {
    return (
      <video
        src={upload.previewUrl}
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
        className="block aspect-video w-full rounded-md bg-black object-contain"
      />
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-3 rounded-md border bg-card px-3 py-2.5 pe-28">
      <HugeiconsIcon
        icon={upload.kind === "audio" ? MusicNote01Icon : File01Icon}
        size={20}
        className="shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <span className="min-w-0 truncate">{upload.fileName}</span>
    </span>
  );
}

/**
 * A media block while its file uploads: the local file, faded, with the
 * progress and a cancel button, or, when the upload failed, Retry and Remove.
 * No hover toolbar, resize handles or block handle meanwhile. Once stored
 * ("finishing") it shows the file at full strength until the stored copy
 * takes its place.
 */
export function UploadingMedia({
  nodeKey,
  upload,
  inline = false,
}: {
  nodeKey: NodeKey;
  upload: NodeUpload;
  /** Images sit inside a paragraph, so this renders with inline-level elements. */
  inline?: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const registry = useUploadRegistry();
  const { t } = useTranslation();
  const compact = upload.kind === "audio" || upload.kind === "file";
  const percent = Math.round(upload.progress * 100);

  // Cancelling (or removing a failed upload) takes the block out; a replace
  // keeps the block with its previous file.
  const remove = () => {
    if (upload.replacing) {
      registry?.clear(nodeKey);
      return;
    }
    editor.update(() => {
      $getNodeByKey(nodeKey)?.remove();
    });
    registry?.clear(nodeKey);
  };

  const cancelButton = (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      aria-label={t.mediaCancelUpload}
      title={t.mediaCancelUpload}
      onClick={remove}
      className="size-7 shrink-0 rounded-full bg-background/90 shadow-sm hover:bg-background"
    >
      <HugeiconsIcon icon={Cancel01Icon} size={14} aria-hidden="true" />
    </Button>
  );

  const progressLabel = t.mediaUploadProgress.replace("{percent}", String(percent));

  return (
    <span
      data-node-uploading=""
      contentEditable={false}
      aria-busy={upload.status === "uploading"}
      className={cn("relative block w-full select-none", inline && "py-2.5")}
    >
      <span
        className={cn(
          "block transition-opacity",
          upload.status !== "finishing" && "opacity-50",
        )}
      >
        <UploadPreview upload={upload} />
      </span>

      {upload.status === "uploading" ? (
        <>
          {compact ? (
            <span className="absolute inset-y-0 end-2 flex items-center gap-2">
              <span role="status" className="text-sm text-muted-foreground tabular-nums">
                {progressLabel}
              </span>
              {cancelButton}
            </span>
          ) : (
            <>
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span
                  role="status"
                  className="rounded-full bg-background/90 px-3 py-1 text-sm font-medium shadow-sm tabular-nums"
                >
                  {progressLabel}
                </span>
              </span>
              <span className={cn("absolute end-2", inline ? "top-4.5" : "top-2")}>
                {cancelButton}
              </span>
            </>
          )}
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-x-0 h-1 overflow-hidden rounded-full bg-foreground/10",
              inline ? "bottom-2.5" : "bottom-0",
            )}
          >
            <span
              className="block h-full bg-primary transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </span>
        </>
      ) : null}

      {upload.status === "error" ? (
        <span
          role="alert"
          className={cn(
            "absolute flex items-center gap-2",
            compact
              ? "inset-y-0 end-2"
              : "inset-0 flex-col justify-center text-center",
          )}
        >
          <span
            className={cn(
              "flex items-center gap-2",
              !compact &&
                "flex-col rounded-lg border bg-background/95 px-4 py-3 shadow-sm",
            )}
          >
            <span className="text-sm font-medium text-destructive">
              {t.mediaUploadFailed}
            </span>
            {!compact && upload.error ? (
              <span className="max-w-64 text-sm text-muted-foreground">{upload.error}</span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <Button type="button" size="sm" variant="outline" onClick={() => registry?.retry(nodeKey)}>
                {t.mediaRetryUpload}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={remove}>
                {upload.replacing ? t.cancel : t.mediaRemoveUpload}
              </Button>
            </span>
          </span>
        </span>
      ) : null}
    </span>
  );
}
