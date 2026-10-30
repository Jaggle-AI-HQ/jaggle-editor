import type { FilesAdapter } from "../../adapters/types";
import { getAttachmentReference } from "../../lib/file-url";

import type { ImageUploadScope } from "../lib/types";

/** The upload field the editor names when the scope gives none. */
export const FILE_FIELD_NAMES = {
  documentAsset: "document_asset",
  commentImage: "comment_image",
} as const;

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export function normalizeImageType(type: string) {
  return type === "image/jpg" ? "image/jpeg" : type;
}

export function isAcceptedImage(file: File) {
  return ACCEPTED_IMAGE_TYPES.has(normalizeImageType(file.type));
}

export type UploadedImage = {
  attachmentId: string;
  src: string;
  altText: string;
  /** A signed URL for the stored file, when the upload returned one. */
  url?: string;
};

/** Progress (0–1) and cancelling for an upload. */
export type UploadOptions = {
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
};

/**
 * Uploads through the app's `files` adapter and returns the stored reference.
 * The editor keeps the reference in its content, never the URL.
 */
export async function uploadToApp(
  files: FilesAdapter,
  file: File,
  scope: ImageUploadScope,
  options: UploadOptions = {},
) {
  const uploaded = await files.upload(
    file,
    { ...scope, fieldName: scope.fieldName ?? FILE_FIELD_NAMES.documentAsset },
    options,
  );
  const src = getAttachmentReference(uploaded.attachmentId);
  if (!src) {
    throw new Error("The uploaded file is missing its attachment ID.");
  }
  return { attachmentId: uploaded.attachmentId, src, url: uploaded.url };
}

export async function uploadCommentImage(file: File): Promise<UploadedImage> {
  return {
    attachmentId: `local-${crypto.randomUUID()}`,
    src: URL.createObjectURL(file),
    altText: file.name,
  };
}

export function fileFromImageDataUrl(value: string): File | null {
  const match =
    /^data:(image\/(?:png|jpe?g|gif|webp));base64,([a-z0-9+/=\s]+)$/i.exec(
      value.trim(),
    );
  if (!match?.[1] || !match[2]) return null;

  const type = normalizeImageType(match[1].toLowerCase());
  if (!ACCEPTED_IMAGE_TYPES.has(type)) return null;

  try {
    const binary = atob(match[2].replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const extension = type === "image/jpeg" ? "jpg" : type.slice("image/".length);
    return new File([bytes], `pasted.${extension}`, { type });
  } catch {
    return null;
  }
}

/**
 * With an entity scope and the app's `files` adapter, uploads the image and
 * stores an attachment reference. Without either (a preview), keeps a local
 * object URL.
 */
export async function uploadEditorImage(
  file: File,
  scope: ImageUploadScope | undefined,
  files: FilesAdapter | undefined,
  options?: UploadOptions,
): Promise<UploadedImage> {
  if (!isAcceptedImage(file)) {
    throw new Error("Use a PNG, JPEG, GIF, or WebP image.");
  }
  if (!scope || !files) {
    options?.onProgress?.(1);
    return uploadCommentImage(file);
  }

  const uploaded = await uploadToApp(files, file, scope, options);
  return { ...uploaded, altText: file.name };
}

/**
 * Why an upload failed, in words for the person who tried it. Reads an HTTP
 * client's error body (`response.data.error` or `.message`) when there is one.
 */
export function uploadErrorMessage(caught: unknown): string {
  const response =
    caught && typeof caught === "object" && "response" in caught
      ? (caught as { response?: { data?: unknown } }).response
      : undefined;
  if (response) {
    const data = response.data;
    if (data && typeof data === "object") {
      for (const key of ["error", "message"] as const) {
        const value = (data as Record<string, unknown>)[key];
        if (typeof value === "string" && value.trim()) return value;
      }
    }
    return "The file couldn't be stored. Try again.";
  }
  return caught instanceof Error && caught.message
    ? caught.message
    : "The file couldn't be uploaded.";
}
