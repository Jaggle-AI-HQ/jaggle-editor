"use client";

import { useEffect, useRef, useState } from "react";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { $generateHtmlFromNodes } from "@lexical/html";
import { $isLinkNode } from "@lexical/link";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  $isListNode,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type ElementFormatType,
  type LexicalEditor,
  type RangeSelection,
  type SerializedEditorState,
  type TextFormatType,
} from "lexical";
import { AtSign, Bold, Italic, Underline } from "lucide-react";

import { useEditorAdapters, useNotify } from "../../adapters/context";
import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { Separator } from "../../ui/separator";

import { CommentAttachmentButton } from "../comment/attachment-button";
import {
  appendCommentAttachment,
  type CommentAttachment,
} from "../comment/attachment-content";
import { useCommentAttachmentUpload } from "../comment/attachment-upload-plugin";
import { $getActiveTextFormats } from "../extensions/format-state";
import type { CommentSubmitHandler } from "../lib/types";
import {
  $commentHasContent,
  $commentPlainText,
  commentHtmlWithFileUrls,
  stripPreviewUrls,
} from "../utils/comment-content";

import { EmojiButton } from "./emoji-button";
import { LinkButton } from "./link-button";
import { ToolbarIconButton, ToolbarToggle } from "./toolbar-button";

type Align = "left" | "center" | "right" | "justify";

type Formats = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  code: boolean;
  highlight: boolean;
  bullet: boolean;
  number: boolean;
  align: Align;
  link: boolean;
};

const INITIAL_FORMATS: Formats = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  code: false,
  highlight: false,
  bullet: false,
  number: false,
  align: "left",
  link: false,
};

function formatsEqual(current: Formats, next: Formats) {
  return (
    current.bold === next.bold &&
    current.italic === next.italic &&
    current.underline === next.underline &&
    current.strikethrough === next.strikethrough &&
    current.code === next.code &&
    current.highlight === next.highlight &&
    current.bullet === next.bullet &&
    current.number === next.number &&
    current.align === next.align &&
    current.link === next.link
  );
}

function alignFrom(format: ElementFormatType): Align {
  if (format === "center") return "center";
  if (format === "right" || format === "end") return "right";
  if (format === "justify") return "justify";
  return "left";
}

function $readFormats(): Formats {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return INITIAL_FORMATS;

  const anchor = selection.anchor.getNode();
  const list = $findMatchingParent(anchor, $isListNode);
  const listType = list && $isListNode(list) ? list.getListType() : null;
  const element = $isElementNode(anchor) ? anchor : anchor.getParent();
  const format =
    element && $isElementNode(element) ? element.getFormatType() : "";
  const link = $isLinkNode(anchor)
    ? anchor
    : $findMatchingParent(anchor, $isLinkNode);

  const marks = $getActiveTextFormats(selection);
  return {
    bold: marks.includes("bold"),
    italic: marks.includes("italic"),
    underline: marks.includes("underline"),
    strikethrough: marks.includes("strikethrough"),
    code: marks.includes("code"),
    highlight: marks.includes("highlight"),
    bullet: listType === "bullet",
    number: listType === "number",
    align: alignFrom(format),
    link: Boolean(link),
  };
}

function run(editor: LexicalEditor, command: () => void) {
  editor.focus(command);
}

function clearEditor(editor: LexicalEditor) {
  editor.update(() => {
    const root = $getRoot();
    root.clear();
    const paragraph = $createParagraphNode();
    root.append(paragraph);
    paragraph.select();
    const selection = $getSelection();
    if ($isRangeSelection(selection)) selection.setFormat(0);
  });
}

export function CommentToolbar({
  actionLabel,
  cancelLabel,
  onCancel,
  onComment,
  initialEditorState,
  initialHtml,
  initialAttachment,
}: {
  actionLabel: string;
  cancelLabel: string;
  onCancel?: () => void;
  onComment?: CommentSubmitHandler;
  initialEditorState?: SerializedEditorState;
  initialHtml?: string;
  initialAttachment?: CommentAttachment | null;
}) {
  const [editor] = useLexicalComposerContext();
  const { files } = useEditorAdapters();
  const toast = useNotify();
  const [formats, setFormats] = useState(INITIAL_FORMATS);
  const [canSubmit, setCanSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { attachment, uploading, remove, reset } = useCommentAttachmentUpload();
  const onCommentRef = useRef(onComment);
  const onCancelRef = useRef(onCancel);
  const menuSelectionRef = useRef<RangeSelection | null>(null);
  const initialRoot = useRef(
    initialEditorState ? JSON.stringify(initialEditorState.root) : null,
  );
  const initialStateRef = useRef<SerializedEditorState | null>(
    initialEditorState ?? null,
  );

  useEffect(() => {
    if (
      !initialEditorState &&
      (initialHtml !== undefined || initialAttachment)
    ) {
      const initial = editor.getEditorState().toJSON();
      initialRoot.current = JSON.stringify(initial.root);
      initialStateRef.current = initial;
    }
  }, [editor, initialEditorState, initialHtml, initialAttachment]);

  useEffect(() => {
    onCommentRef.current = onComment;
    onCancelRef.current = onCancel;
  }, [onCancel, onComment]);

  useEffect(() => {
    const sync = () => {
      const nextFormats = $readFormats();
      const bodyChanged =
        initialRoot.current === null
          ? $commentHasContent()
          : JSON.stringify(editor.getEditorState().toJSON().root) !==
            initialRoot.current;
      const nextCanSubmit =
        ($commentHasContent() || Boolean(attachment)) &&
        (attachment?.src !== initialAttachment?.src || bodyChanged);
      setFormats((current) =>
        formatsEqual(current, nextFormats) ? current : nextFormats,
      );
      setCanSubmit((current) =>
        current === nextCanSubmit ? current : nextCanSubmit,
      );
    };
    editor.getEditorState().read(sync);
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(sync);
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          sync();
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );
  }, [editor, attachment, initialAttachment]);

  const toggleMark = (format: TextFormatType) => {
    run(editor, () => {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    });
  };

  const captureMenuSelection = () => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      menuSelectionRef.current = $isRangeSelection(selection)
        ? selection.clone()
        : null;
    });
  };

  const runMenuCommand = (command: () => void) => {
    editor.focus(() => {
      editor.update(() => {
        if (menuSelectionRef.current) {
          $setSelection(menuSelectionRef.current.clone());
        }
        command();
      });
    });
  };

  const submit = () => {
    if (!canSubmit || submitting || uploading) return;
    setSubmitting(true);
    let plainText: string;
    let html: string;
    let json: SerializedEditorState;
    try {
      const editorState = editor.getEditorState();
      plainText = editorState.read($commentPlainText);
      const bodyHtml = editorState.read(() =>
        $generateHtmlFromNodes(editor, null),
      );
      const result = appendCommentAttachment(
        editorState.toJSON(),
        bodyHtml,
        attachment,
      );
      html = result.html;
      json = stripPreviewUrls(result.editorState);
    } catch (caught) {
      setSubmitting(false);
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Could not prepare the comment.",
      );
      return;
    }

    void commentHtmlWithFileUrls(html, files?.rawUrl)
      .then((resolvedHtml) =>
        onCommentRef.current?.(json, resolvedHtml, plainText),
      )
      .then(() => {
        clearEditor(editor);
        remove();
      })
      .catch((caught: unknown) => {
        toast.error(
          caught instanceof Error
            ? caught.message
            : "Could not send the comment.",
        );
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pb-3 pt-1">
      <div className="flex min-w-0 flex-wrap items-center gap-0.5 text-muted-foreground">
        <ToolbarToggle
          label="Bold (⌘B)"
          pressed={formats.bold}
          onPressed={() => toggleMark("bold")}
        >
          <Bold />
        </ToolbarToggle>
        <ToolbarToggle
          label="Italic (⌘I)"
          pressed={formats.italic}
          onPressed={() => toggleMark("italic")}
        >
          <Italic />
        </ToolbarToggle>
        <ToolbarToggle
          label="Underline (⌘U)"
          pressed={formats.underline}
          onPressed={() => toggleMark("underline")}
        >
          <Underline />
        </ToolbarToggle>
        <Separator orientation="vertical" className="mx-1.5 h-5" />
        <LinkButton active={formats.link} />
        <EmojiButton />
        <CommentAttachmentButton />
        <ToolbarIconButton
          label="Mention"
          onClick={() =>
            run(editor, () => {
              editor.update(() => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection)) return;
                if (!selection.isCollapsed()) {
                  selection.insertText("@");
                  return;
                }
                const node = selection.anchor.getNode();
                const before = $isTextNode(node)
                  ? node.getTextContent().slice(0, selection.anchor.offset)
                  : "";
                const needsSpace = before.length > 0 && !/\s$/.test(before);
                selection.insertText(needsSpace ? " @" : "@");
              });
            })
          }
        >
          <AtSign />
        </ToolbarIconButton>
        <DropdownMenu
          onOpenChange={(open) => {
            if (open) captureMenuSelection();
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="More formatting"
              onPointerDown={captureMenuSelection}
            >
              <HugeiconsIcon
                icon={MoreHorizontalIcon}
                size={16}
                aria-hidden="true"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="max-h-72 w-52 overflow-y-auto"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <DropdownMenuLabel>More formatting</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={formats.strikethrough}
              onCheckedChange={() =>
                runMenuCommand(() =>
                  editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough"),
                )
              }
            >
              Strikethrough
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={formats.code}
              onCheckedChange={() =>
                runMenuCommand(() =>
                  editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code"),
                )
              }
            >
              Inline code
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={formats.highlight}
              onCheckedChange={() =>
                runMenuCommand(() =>
                  editor.dispatchCommand(FORMAT_TEXT_COMMAND, "highlight"),
                )
              }
            >
              Highlight
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {(["left", "center", "right", "justify"] as const).map(
              (alignment) => (
                <DropdownMenuCheckboxItem
                  key={alignment}
                  checked={formats.align === alignment}
                  onCheckedChange={() =>
                    runMenuCommand(() =>
                      editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignment),
                    )
                  }
                >
                  Align {alignment}
                </DropdownMenuCheckboxItem>
              ),
            )}
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={formats.bullet}
              onCheckedChange={() =>
                runMenuCommand(() =>
                  editor.dispatchCommand(
                    INSERT_UNORDERED_LIST_COMMAND,
                    undefined,
                  ),
                )
              }
            >
              Bullet list
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={formats.number}
              onCheckedChange={() =>
                runMenuCommand(() =>
                  editor.dispatchCommand(
                    INSERT_ORDERED_LIST_COMMAND,
                    undefined,
                  ),
                )
              }
            >
              Numbered list
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem
              onSelect={() =>
                runMenuCommand(() =>
                  editor.dispatchCommand(INSERT_TABLE_COMMAND, {
                    columns: "3",
                    rows: "3",
                    includeHeaders: true,
                  }),
                )
              }
            >
              Insert table
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploading || submitting}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (initialStateRef.current) {
                editor.setEditorState(
                  editor.parseEditorState(
                    JSON.stringify(initialStateRef.current),
                  ),
                );
              } else {
                clearEditor(editor);
              }
              reset();
              onCancelRef.current?.();
            }}
          >
            {cancelLabel}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit || uploading}
          isLoading={submitting}
          onMouseDown={(event) => event.preventDefault()}
          onClick={submit}
        >
          {uploading ? "Uploading..." : actionLabel}
        </Button>
      </div>
    </div>
  );
}
