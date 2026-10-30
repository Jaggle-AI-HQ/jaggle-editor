"use client";

import { type ReactNode, useEffect, useState } from "react";

import {
  Alert02Icon,
  File01Icon,
  Maximize01Icon,
  MusicNote01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

import { useEditorAdapters } from "../../adapters/context";
import { Loader } from "../../ui/loader";

import { useInlineFileUrl } from "../components/media-view";

import type { CommentAttachment } from "./attachment-content";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
};

/** The viewer picks its preview by extension; pasted files may not have one. */
function viewerFileName(attachment: CommentAttachment) {
  if (/\.[a-z0-9]+$/i.test(attachment.name)) return attachment.name;
  const extension = attachment.mimeType ? MIME_EXTENSIONS[attachment.mimeType] : undefined;
  return extension ? `${attachment.name}.${extension}` : attachment.name;
}

function formatSize(size?: number) {
  if (size === undefined) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** The attachment's signed URL; `null` while loading or when it can't be loaded. */
function useAttachmentUrl(src: string) {
  const { url, isError, isLoading } = useInlineFileUrl(src);
  // An unresolved reference comes back as itself, which no browser can load.
  const unavailable = !isLoading && (isError || !url || url.startsWith("jaggle-file://"));
  return { url: unavailable ? null : url, isLoading, unavailable };
}

function AttachmentViewer({
  attachment,
  url,
  open,
  onOpenChange,
}: {
  attachment: CommentAttachment;
  url: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { files } = useEditorAdapters();
  const FileViewer = files?.FileViewer;
  // Without the app's viewer, the file opens in a new tab instead.
  useEffect(() => {
    if (!open || FileViewer) return;
    window.open(url, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  }, [FileViewer, onOpenChange, open, url]);
  if (!open || !FileViewer) return null;
  return (
    <FileViewer
      file={{
        id: attachment.attachmentId ?? attachment.src,
        url,
        name: viewerFileName(attachment),
        mimeType: attachment.mimeType,
        size: attachment.size,
      }}
      open
      onOpenChange={onOpenChange}
    />
  );
}

/** Stands in for an image or video while its URL loads. */
function MediaPlaceholder() {
  return (
    <span className="flex h-40 w-60 max-w-full items-center justify-center rounded-lg border border-border bg-muted/40">
      <Loader className="[&_svg]:w-5" />
    </span>
  );
}

/** Name, kind and size beside an icon: files, audio, and anything that can't load. */
function AttachmentCard({
  attachment,
  icon,
  detail,
  children,
}: {
  attachment: CommentAttachment;
  icon: IconSvgElement;
  detail?: string;
  children?: ReactNode;
}) {
  const sizeLabel = formatSize(attachment.size);
  return (
    <div className="flex w-full max-w-sm min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/40 p-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <HugeiconsIcon icon={icon} size={20} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-start">
          <span className="block truncate font-medium" title={attachment.name}>
            {attachment.name}
          </span>
          <span className="block text-sm text-muted-foreground">
            {detail ?? <span className="capitalize">{attachment.kind}</span>}
            {sizeLabel ? ` · ${sizeLabel}` : ""}
          </span>
        </span>
      </div>
      {children}
    </div>
  );
}

/**
 * A comment's attachment as people read it: images and videos inline (the
 * image opens the viewer; the video plays in place and can expand), audio
 * with a player, and other files as a card that opens the viewer. Downloading
 * happens in the viewer.
 */
export function CommentAttachmentView({ attachment }: { attachment: CommentAttachment }) {
  const { url, isLoading, unavailable } = useAttachmentUrl(attachment.src);
  const [viewerOpen, setViewerOpen] = useState(false);

  const viewer = url ? (
    <AttachmentViewer
      attachment={attachment}
      url={url}
      open={viewerOpen}
      onOpenChange={setViewerOpen}
    />
  ) : null;

  if (unavailable) {
    return (
      <div className="mt-2">
        <AttachmentCard attachment={attachment} icon={Alert02Icon} detail="Unavailable" />
      </div>
    );
  }

  if (attachment.kind === "image") {
    return (
      <div className="mt-2">
        <button
          type="button"
          aria-label={`Open ${attachment.name}`}
          disabled={!url}
          onClick={() => setViewerOpen(true)}
          className="block max-w-full overflow-hidden rounded-lg border border-border bg-muted/40 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {url ? (
            // Sized by the image itself, within 320×240.
            <img
              src={url}
              alt={attachment.name}
              width={320}
              height={240}
              loading="lazy"
              className="block h-auto max-h-60 w-auto max-w-80 object-contain"
            />
          ) : (
            <MediaPlaceholder />
          )}
        </button>
        {viewer}
      </div>
    );
  }

  if (attachment.kind === "video") {
    return (
      <div className="group/video relative mt-2 w-fit max-w-full">
        {url ? (
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            aria-label={attachment.name}
            className="block max-h-60 max-w-80 rounded-lg border border-border bg-black"
          />
        ) : (
          <MediaPlaceholder />
        )}
        {url ? (
          <button
            type="button"
            aria-label={`Expand ${attachment.name}`}
            onClick={() => setViewerOpen(true)}
            className="absolute end-2 top-2 flex size-7 items-center justify-center rounded-md bg-black/60 text-white opacity-0 outline-none transition-opacity group-hover/video:opacity-100 hover:bg-black/75 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <HugeiconsIcon icon={Maximize01Icon} size={16} aria-hidden="true" />
          </button>
        ) : null}
        {viewer}
      </div>
    );
  }

  if (attachment.kind === "audio") {
    return (
      <div className="mt-2">
        <AttachmentCard attachment={attachment} icon={MusicNote01Icon}>
          {url ? (
            <audio
              src={url}
              controls
              preload="metadata"
              aria-label={attachment.name}
              className="h-9 w-full"
            />
          ) : isLoading ? (
            <Loader className="[&_svg]:w-5" />
          ) : null}
        </AttachmentCard>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-label={`Open ${attachment.name}`}
        disabled={!url}
        onClick={() => setViewerOpen(true)}
        className="block w-full max-w-sm rounded-xl text-start outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <AttachmentCard attachment={attachment} icon={File01Icon} />
      </button>
      {viewer}
    </div>
  );
}
