"use client";

import { DOCUMENT_LAYOUT } from "../document/layout";
import { CommentsPanel } from "../plugins/floating/comment-plugin";

export function CommentsSidebar({ onClose }: { onClose: () => void }) {
  return (
    <aside className={DOCUMENT_LAYOUT.sidePanel}>
      <CommentsPanel onClose={onClose} />
    </aside>
  );
}
