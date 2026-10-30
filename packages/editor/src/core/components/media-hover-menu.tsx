"use client";

export { MediaCaption } from "./media-view";

/** Opens the file in a new tab, or downloads it when the server says so. */
export function downloadMediaFile(url: string | null, name: string) {
  if (!url) return;
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener noreferrer";
  link.target = "_blank";
  document.body.append(link);
  link.click();
  link.remove();
}
