"use client";

import { useRef } from "react";

import { FileUploadIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

import { useNotify } from "../../adapters/context";
import { Button } from "../../ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../ui/tooltip";

import {
  COMMENT_ATTACHMENT_LIMIT_MESSAGE,
  useCommentAttachmentUpload,
} from "./attachment-upload-plugin";

export function CommentAttachmentButton() {
  const [editor] = useLexicalComposerContext();
  const toast = useNotify();
  const inputRef = useRef<HTMLInputElement>(null);
  const { attachment, upload, uploading } = useCommentAttachmentUpload();

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Attach a file"
            aria-busy={uploading}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (attachment || uploading) {
                toast.message(
                  uploading
                    ? "Wait for the current attachment to finish uploading."
                    : COMMENT_ATTACHMENT_LIMIT_MESSAGE,
                );
                return;
              }
              inputRef.current?.click();
            }}
          >
            <HugeiconsIcon icon={FileUploadIcon} size={16} aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Attach one image, video, audio, or file</TooltipContent>
      </Tooltip>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a comment attachment"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          editor.focus();
          void upload(files);
        }}
      />
    </>
  );
}
