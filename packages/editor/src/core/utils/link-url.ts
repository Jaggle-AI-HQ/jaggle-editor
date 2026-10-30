export function normalizeLinkUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("?")
  ) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
