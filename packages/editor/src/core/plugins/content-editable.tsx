import { useEffect } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  type ContentEditableElementProps,
  ContentEditable as LexicalContentEditable,
} from "@lexical/react/LexicalContentEditable";
import { cva, type VariantProps } from "class-variance-authority";
import { $getRoot, HISTORY_MERGE_TAG } from "lexical";

import { cn } from "../../lib/utils";

import { useTranslation } from "../lib/locale";

const contentEditableVariants = cva(
  "min-h-full w-full bg-transparent outline-none",
  {
    variants: {
      variant: {
        default: "px-2.5 py-2",
        toolbar: "px-4 py-4",
        draggable: "px-12 py-4",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const placeholderVariants = cva(
  "pointer-events-none absolute inset-0 text-muted-foreground/60 select-none",
  {
    variants: {
      variant: {
        default: "px-2.5 py-2",
        toolbar: "px-4 py-4",
        draggable: "px-12 py-4",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function ContentEditable({
  variant,
  className,
  placeholder,
  placeholderClassName,
  ...props
}: VariantProps<typeof contentEditableVariants> &
  Omit<ContentEditableElementProps, "editor" | "className" | "placeholder"> & {
    className?: string;
    placeholder?: string;
    placeholderClassName?: string;
  }) {
  const [editor] = useLexicalComposerContext();
  const { dir, t } = useTranslation();
  const placeholderText = placeholder || t.typeSomething;

  useEffect(() => {
    editor.update(
      () => {
        $getRoot().setDirection(dir);
      },
      { tag: HISTORY_MERGE_TAG },
    );
  }, [editor, dir]);

  return (
    <LexicalContentEditable
      {...props}
      className={cn(contentEditableVariants({ variant }), className)}
      aria-placeholder={placeholderText}
      placeholder={
        <div
          className={cn(placeholderVariants({ variant }), placeholderClassName)}
        >
          {placeholderText}
        </div>
      }
    />
  );
}
