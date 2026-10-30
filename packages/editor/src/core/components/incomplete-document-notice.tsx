"use client";

import { Alert02Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "../../ui/button";
import { cn } from "../../lib/utils";

import { useTranslation } from "../lib/locale";

/**
 * Says the saved document came back incomplete (`content_truncated`), or
 * didn't load at all (`failed`), and why that matters here: editing would save
 * a partial or empty copy over the real one, a read-only view may be cut off,
 * an export would miss content.
 */
export function IncompleteDocumentNotice({
  purpose,
  failed = false,
  onRetry,
  retrying = false,
  className,
}: {
  purpose: "edit" | "view" | "export";
  /** The document didn't load at all, rather than partly. */
  failed?: boolean;
  onRetry: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const title = failed ? t.documentFailedTitle : t.documentIncompleteTitle;
  const detail = failed
    ? t.documentFailedEdit
    : {
        edit: t.documentIncompleteEdit,
        view: t.documentIncompleteView,
        export: t.documentIncompleteExport,
      }[purpose];

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200",
        className,
      )}
    >
      <HugeiconsIcon icon={Alert02Icon} size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="opacity-90">{detail}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={retrying}
        onClick={onRetry}
        className="shrink-0 border-amber-300/70 bg-transparent hover:bg-amber-100 dark:border-amber-700/60 dark:hover:bg-amber-900/40"
      >
        <HugeiconsIcon icon={RefreshIcon} size={14} aria-hidden="true" className={cn(retrying && "animate-spin")} />
        {t.documentIncompleteRetry}
      </Button>
    </div>
  );
}
