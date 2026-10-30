"use client";

import { type ReactNode, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { AudioLines, FileUp, ImageOffIcon, Loader2 } from "lucide-react";

import { EDITOR_QUERY_KEY, useFileUrlResolver } from "../../adapters/context";
import { cn } from "../../lib/utils";

import {
  type BlockAlign,
  type BlockSize,
  blockBoxStyle,
  isFit,
} from "../lib/block-layout";
import { useTranslation } from "../lib/locale";

const REFERENCE_PREFIX = "jaggle-file://";

/**
 * Resolves `jaggle-file://` references through the app's `files.resolveUrl`;
 * other sources pass through. Without the adapter a reference stays as it is.
 */
export function useInlineFileUrl(src: string) {
  const resolveUrl = useFileUrlResolver();
  const reference = src.startsWith(REFERENCE_PREFIX);
  const resolved = useQuery({
    queryKey: [EDITOR_QUERY_KEY, "inline-file", src],
    queryFn: () => resolveUrl(src),
    enabled: reference,
    staleTime: 60_000,
  });
  if (!reference) {
    return { url: src, isError: false, isLoading: false };
  }
  return {
    url: resolved.data ?? null,
    isError: resolved.isError,
    isLoading: resolved.isPending,
  };
}

export function MediaFailed({ label }: { label: string }) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-md border border-dashed bg-muted px-3 py-3 text-muted-foreground">
      <span className="text-sm">{label}</span>
    </div>
  );
}

/**
 * The file block's card. Shared by the editor and read-only views. `href`
 * makes it a link to the file; `nameSlot` replaces the name (the rename
 * field).
 */
export function FileCard({
  name,
  href,
  nameSlot,
}: {
  name: string;
  href?: string;
  nameSlot?: ReactNode;
}) {
  const row = (
    <>
      <FileUp className="size-5 shrink-0 text-muted-foreground" />
      {nameSlot ?? <span className="min-w-0 truncate">{name}</span>}
    </>
  );
  return (
    <div className="overflow-hidden rounded-md border bg-card text-foreground">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 text-foreground no-underline outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          {row}
        </a>
      ) : (
        <div className="flex items-center gap-3 px-3 py-2.5">{row}</div>
      )}
    </div>
  );
}

/** The audio block's player card. Shared by the editor and read-only views. */
export function AudioCard({
  url,
  name,
  onError,
}: {
  url: string;
  name: string;
  onError: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <div className="flex items-center gap-3 px-3 py-2">
        <AudioLines className="size-5 shrink-0 text-muted-foreground" />
        <audio
          controls
          src={url}
          title={name}
          onError={onError}
          className="min-w-0 flex-1"
        />
      </div>
    </div>
  );
}

/**
 * A block's caption: small muted text 4 px under the block, starting at the
 * block's own start edge (so under a narrow centered image it starts at the
 * image, not the page). Blocks are 20 px apart, so the caption reads as part
 * of the block above. The same for every block, in edit and read-only.
 */
export function MediaCaption({
  caption,
  editable,
  onChange,
}: {
  caption: string | undefined;
  editable: boolean;
  onChange: (caption: string) => void;
}) {
  const { t, dir } = useTranslation();
  if (caption === undefined) return null;

  return (
    <span className="mt-1 block w-full text-start text-sm text-muted-foreground">
      {editable ? (
        <input
          key={caption}
          dir={dir}
          type="text"
          contentEditable={false}
          aria-label={t.mediaCaptionPlaceholder}
          placeholder={t.mediaCaptionPlaceholder}
          defaultValue={caption}
          onBlur={(event) => {
            const nextCaption = event.currentTarget.value;
            if (nextCaption !== caption) onChange(nextCaption);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.currentTarget.value = caption;
            }
          }}
          className="block w-full border-0 bg-transparent p-0 text-start outline-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
        />
      ) : (
        <span className="block">{caption}</span>
      )}
    </span>
  );
}

const noop = () => undefined;

/**
 * Read-only counterpart of the editor's block frame: the same width,
 * alignment and caption, without handles or toolbar.
 */
export function ReadonlyBlock({
  size,
  align,
  caption,
  inline = false,
  children,
}: {
  size: BlockSize;
  align: BlockAlign;
  caption: string | undefined;
  inline?: boolean;
  children: ReactNode;
}) {
  const fillsColumn = isFit(size) && size.maxPx === undefined;
  return (
    <span
      className={cn("block w-full", inline && "py-2.5")}
      style={{ textAlign: fillsColumn ? undefined : align }}
    >
      <span
        className="relative inline-block max-w-full text-start align-top"
        style={blockBoxStyle(size)}
      >
        {children}
        <MediaCaption caption={caption} editable={false} onChange={noop} />
      </span>
    </span>
  );
}

/*
 * Read-only views below match the editor's media blocks with editing off:
 * same player or card, same caption, no hover menu.
 */

export function ImageView({
  src,
  altText,
  caption,
  size,
  align,
}: {
  src: string;
  altText: string;
  caption: string | undefined;
  size: BlockSize;
  align: BlockAlign;
}) {
  const { url, isError } = useInlineFileUrl(src);
  const [isLoadError, setIsLoadError] = useState(false);
  return (
    <ReadonlyBlock inline size={size} align={align} caption={caption}>
      {isError || isLoadError ? (
        <span className="flex aspect-video w-full max-w-sm flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted text-muted-foreground">
          <ImageOffIcon className="size-6" />
          <span className="text-xs">{altText || "Image failed to load"}</span>
        </span>
      ) : url ? (
        <img
          src={url}
          alt={altText}
          draggable={false}
          onError={() => setIsLoadError(true)}
          className="block h-auto w-full max-w-full rounded-md select-none"
        />
      ) : (
        <span className="block aspect-video w-full max-w-sm animate-pulse rounded-md bg-muted" />
      )}
    </ReadonlyBlock>
  );
}

export function VideoView({
  src,
  name,
  caption,
  size,
  align,
  aspectRatio = "16 / 9",
}: {
  src: string;
  name: string;
  caption: string | undefined;
  size: BlockSize;
  align: BlockAlign;
  aspectRatio?: string;
}) {
  const { t } = useTranslation();
  const { url, isError, isLoading } = useInlineFileUrl(src);
  const [isLoadError, setIsLoadError] = useState(false);
  return (
    <ReadonlyBlock size={size} align={align} caption={caption}>
      {isError || isLoadError ? (
        <MediaFailed label={t.mediaLoadError} />
      ) : !url || isLoading ? (
        <span
          className="flex w-full animate-pulse items-center justify-center rounded-md bg-muted"
          style={{ aspectRatio }}
        >
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </span>
      ) : (
        <video
          controls
          src={url}
          title={name}
          onError={() => setIsLoadError(true)}
          style={{ aspectRatio }}
          className="block h-auto w-full max-w-full rounded-md bg-black"
        />
      )}
    </ReadonlyBlock>
  );
}

export function AudioView({
  src,
  name,
  caption,
}: {
  src: string;
  name: string;
  caption: string | undefined;
}) {
  const { t } = useTranslation();
  const { url, isError, isLoading } = useInlineFileUrl(src);
  const [isLoadError, setIsLoadError] = useState(false);
  return (
    <div className="relative">
      {isError || isLoadError ? (
        <MediaFailed label={t.mediaLoadError} />
      ) : !url || isLoading ? (
        <div className="flex h-12 w-full animate-pulse items-center rounded-md bg-muted px-3">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <AudioCard url={url} name={name} onError={() => setIsLoadError(true)} />
      )}
      <MediaCaption caption={caption} editable={false} onChange={noop} />
    </div>
  );
}

/** The file card; in read-only it also opens the file, which changes nothing. */
export function FileView({
  src,
  name,
  caption,
}: {
  src: string;
  name: string;
  caption: string | undefined;
}) {
  const { t } = useTranslation();
  const { url, isError, isLoading } = useInlineFileUrl(src);
  return (
    <div className="relative">
      {isError ? (
        <MediaFailed label={t.mediaLoadError} />
      ) : !url || isLoading ? (
        <div className="flex h-12 w-full animate-pulse items-center gap-3 rounded-md bg-muted px-3">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <FileCard name={name} href={url} />
      )}
      <MediaCaption caption={caption} editable={false} onChange={noop} />
    </div>
  );
}
