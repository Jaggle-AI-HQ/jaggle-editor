"use client";

import type { ReactNode } from "react";

import SkeletonParagraph from "../../ui/skeleton-paragraph";
import { cn } from "../../lib/utils";

import { useTranslation } from "../lib/locale";
import type { DocumentHeader } from "../lib/types";

import { DOCUMENT_LAYOUT } from "./layout";

/**
 * Shown while the editor code loads and while the caller's content is
 * fetching (`dataLoading`). It keeps the editor's layout: the caller's header
 * row stays visible and the placeholder lines sit where the text will start.
 */
export function DocumentLoading({
  page = false,
  sideMenu = false,
  header,
  hasActions = false,
  notice,
}: {
  page?: boolean;
  sideMenu?: boolean;
  header?: DocumentHeader;
  hasActions?: boolean;
  /** Shown in place of the loading lines (a document that can't open yet). */
  notice?: ReactNode;
}) {
  const { t } = useTranslation();
  const hasHeader =
    header?.start != null || header?.end != null || header?.trailing != null;

  return (
    <div className={DOCUMENT_LAYOUT.root} aria-busy="true">
      {hasHeader ? (
        <div className={DOCUMENT_LAYOUT.headerRow}>
          <div className={DOCUMENT_LAYOUT.headerStart}>{header?.start}</div>
          {header?.end != null ? (
            <div className={DOCUMENT_LAYOUT.headerEnd}>{header.end}</div>
          ) : null}
          {header?.trailing != null ? (
            <div className={DOCUMENT_LAYOUT.headerEnd}>{header.trailing}</div>
          ) : null}
        </div>
      ) : null}
      {/* w-full: in this flex column, mx-auto would otherwise shrink the
          column to its content, unlike the editor's block scroll container. */}
      <div
        className={cn(
          "w-full",
          page ? DOCUMENT_LAYOUT.pageColumn : sideMenu && DOCUMENT_LAYOUT.handleSpace,
          !page && hasActions && !hasHeader && DOCUMENT_LAYOUT.cornerActionsSpace,
        )}
      >
        {notice ? (
          <div className={DOCUMENT_LAYOUT.contentInset}>{notice}</div>
        ) : (
          <div role="status" className={DOCUMENT_LAYOUT.contentInset}>
            <span className="sr-only">{t.documentLoading}</span>
            <SkeletonParagraph />
          </div>
        )}
      </div>
    </div>
  );
}
