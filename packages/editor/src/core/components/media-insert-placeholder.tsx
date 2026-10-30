"use client";

import { useRef, useState, type ReactNode } from "react";

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";

import { useTranslation } from "../lib/locale";

export function mediaLinkUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function MediaInsertPlaceholder({
  icon,
  label,
  accept,
  hint,
  onUpload,
  onLink,
  defaultOpen = true,
}: {
  icon: ReactNode;
  label: string;
  accept?: string;
  hint?: string;
  onUpload: (file: File) => Promise<boolean>;
  onLink: (url: string) => void;
  /** Open the picker on mount: for a block just inserted here. */
  defaultOpen?: boolean;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submitLink = () => {
    const url = mediaLinkUrl(link);
    if (!url) {
      setError(t.mediaInvalidLink);
      return;
    }
    setError("");
    onLink(url);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          contentEditable={false}
          className="flex w-full items-center gap-3 rounded-lg bg-muted/70 px-4 py-3 text-left text-muted-foreground hover:bg-muted"
        >
          <span className="shrink-0">{icon}</span>
          <span>{label}</span>
        </button>
      </PopoverTrigger>
      {open ? (
        <PopoverContent
          className="w-80 overflow-hidden p-0"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <Tabs defaultValue="upload" className="gap-0">
            <TabsList className="h-11 w-full justify-start rounded-none px-2">
              <TabsTrigger value="upload">{t.mediaUploadTab}</TabsTrigger>
              <TabsTrigger value="link">{t.link}</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="p-3">
              <Button
                type="button"
                className="w-full"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {busy ? t.mediaUploading : t.mediaChooseFile}
              </Button>
              {hint ? (
                <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
              ) : null}
            </TabsContent>
            <TabsContent value="link" className="space-y-2 p-3">
              <Input
                dir="ltr"
                type="url"
                aria-label={t.mediaLinkPlaceholder}
                placeholder={t.mediaLinkPlaceholder}
                value={link}
                onChange={(event) => {
                  setLink(event.target.value);
                  setError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitLink();
                  }
                }}
              />
              {error ? (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="button" className="w-full" onClick={submitLink}>
                {t.mediaEmbedLink}
              </Button>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            await onUpload(file);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Popover>
  );
}
