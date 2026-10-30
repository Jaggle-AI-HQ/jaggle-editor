"use client";

import { useState } from "react";

import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Textarea } from "../../ui/textarea";

import { useTranslation } from "../lib/locale";

/** Edits an image's alt text. Mounted only while open, so it starts from the current text. */
export function AltTextDialog({
  altText,
  onSave,
  onClose,
}: {
  altText: string;
  onSave: (altText: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(altText);
  const save = () => {
    onSave(draft.trim());
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-5 sm:max-w-md" onCloseAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t.blockAltText}</DialogTitle>
          <DialogDescription>{t.blockAltTextHint}</DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          rows={3}
          value={draft}
          aria-label={t.blockAltText}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              save();
            }
          }}
        />
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={save}>
            {t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
