import type { FilesAdapter } from "../../adapters/types";

import type { ImageUploadScope } from "../lib/types";

import { isAcceptedImage, type UploadOptions, uploadToApp } from "./images";

export type MediaKind = "image" | "video" | "audio" | "file";

export type UploadedMedia = {
  kind: Exclude<MediaKind, "image">;
  attachmentId: string;
  src: string;
  name: string;
  mimeType: string;
  /** A signed URL for the stored file, when the upload returned one. */
  url?: string;
};

export function mediaKindFromFile(file: File): MediaKind {
  const type = file.type.toLowerCase();
  if (isAcceptedImage(file)) {
    return "image";
  }
  if (type.startsWith("video/")) {
    return "video";
  }
  if (type.startsWith("audio/")) {
    return "audio";
  }
  return "file";
}

async function uploadLocalMedia(
  file: File,
  kind: UploadedMedia["kind"],
): Promise<UploadedMedia> {
  return {
    kind,
    attachmentId: `local-${crypto.randomUUID()}`,
    src: URL.createObjectURL(file),
    name: file.name || "File",
    mimeType: file.type,
  };
}

/** Like `uploadEditorImage`: through the app's `files` adapter, else a local object URL. */
export async function uploadEditorMedia(
  file: File,
  kind: UploadedMedia["kind"],
  scope: ImageUploadScope | undefined,
  files: FilesAdapter | undefined,
  options?: UploadOptions,
): Promise<UploadedMedia> {
  if (!scope || !files) {
    options?.onProgress?.(1);
    return uploadLocalMedia(file, kind);
  }

  const uploaded = await uploadToApp(files, file, scope, options);
  return {
    kind,
    ...uploaded,
    name: file.name || "File",
    mimeType: file.type,
  };
}
