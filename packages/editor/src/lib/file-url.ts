/**
 * Saved content refers to uploaded files as `jaggle-file://attachment/<id>`.
 * The host's `files` adapter turns a reference into a URL it can show
 * (`resolveUrl`) or link to (`rawUrl`); the reference itself is part of the
 * stored content, so every app reads and writes the same form.
 */

const ATTACHMENT_REFERENCE_PREFIX = "jaggle-file://attachment/";
const LEGACY_ATTACHMENT_SIGNATURE_PATTERN =
  /(?:\\?&|\?)(?:X-Amz-|AWSAccessKeyId=|Expires=|Signature=)/i;

export function getAttachmentReference(attachmentId: string) {
  return attachmentId ? createAttachmentReference(attachmentId) : "";
}

function createAttachmentReference(attachmentId: string) {
  return `${ATTACHMENT_REFERENCE_PREFIX}${encodeURIComponent(attachmentId)}`;
}

export function getAttachmentIdFromReference(src: string) {
  if (!src.startsWith(ATTACHMENT_REFERENCE_PREFIX)) return null;

  const encodedSource = src.slice(ATTACHMENT_REFERENCE_PREFIX.length);
  const legacySignatureIndex = encodedSource.search(
    LEGACY_ATTACHMENT_SIGNATURE_PATTERN,
  );
  const encodedId =
    legacySignatureIndex >= 0
      ? encodedSource.slice(0, legacySignatureIndex)
      : encodedSource;
  if (!encodedId) {
    return null;
  }

  try {
    const attachmentId = decodeURIComponent(encodedId);
    return attachmentId &&
      attachmentId.trim() === attachmentId &&
      !/[/?#\\&]/.test(attachmentId)
      ? attachmentId
      : null;
  } catch {
    return null;
  }
}
