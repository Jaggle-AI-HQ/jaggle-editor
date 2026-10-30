import { useMemo, useState } from "react";

import { $createLinkNode } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  FORMAT_ELEMENT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type ElementFormatType,
  type RangeSelection,
} from "lexical";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Download,
  History,
  IndentDecrease,
  IndentIncrease,
  Link as LinkIcon,
  MessageSquare,
  PilcrowLeft,
  PilcrowRight,
  Redo2,
  Smile,
  TextSearch,
  Undo2,
  Upload,
  type LucideIcon,
} from "lucide-react";

import { Button } from "../../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../ui/dialog";
import { Input } from "../../../ui/input";

import { EXPORT_FORMATS } from "../../components/shell-actions";
import { useDocumentUi } from "../../document/ui-context";
import { TOGGLE_FIND_REPLACE_COMMAND } from "../../extensions/find-replace";
import { validateUrl } from "../../extensions/link";
import { useTranslation, type Locale } from "../../lib/locale";
import { insertEmojiTrigger } from "../emoji-picker-plugin";

import {
  type ComponentPickerGroup,
  type ComponentPickerItem,
  useComponentPickerItems,
} from "./component-picker-plugin";

const ALIGNMENTS: {
  format: Exclude<ElementFormatType, "">;
  labelKey: keyof Locale;
  icon: LucideIcon;
}[] = [
  { format: "left", labelKey: "alignLeft", icon: AlignLeft },
  { format: "center", labelKey: "alignCenter", icon: AlignCenter },
  { format: "right", labelKey: "alignRight", icon: AlignRight },
  { format: "justify", labelKey: "alignJustify", icon: AlignJustify },
  { format: "start", labelKey: "alignStart", icon: PilcrowLeft },
  { format: "end", labelKey: "alignEnd", icon: PilcrowRight },
];

function action(
  value: string,
  label: string,
  icon: LucideIcon,
  group: ComponentPickerGroup,
  onSelect: () => void,
  keywords: string[] = [],
): ComponentPickerItem {
  const Icon = icon;
  return {
    value,
    label,
    icon: <Icon className="text-muted-foreground" />,
    group,
    keywords,
    onSelect,
  };
}

export function EditorActionsPickerPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const { showComments, openComments, openVersions, openImport, exportAs } =
    useDocumentUi();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSelection, setLinkSelection] = useState<RangeSelection | null>(null);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("https://");
  const items = useMemo<ComponentPickerItem[]>(() => {
    return [
      action("undo", t.undo, Undo2, "tools", () =>
        editor.dispatchCommand(UNDO_COMMAND, undefined),
      ),
      action("redo", t.redo, Redo2, "tools", () =>
        editor.dispatchCommand(REDO_COMMAND, undefined),
      ),
      action("find-replace", t.findAndReplace, TextSearch, "tools", () =>
        editor.dispatchCommand(TOGGLE_FIND_REPLACE_COMMAND, undefined),
      ),
      // Page actions also live in the editor's corner; these reach them from the keyboard.
      ...(showComments
        ? [
            action("open-comments", t.comments, MessageSquare, "tools", openComments, [
              "comments",
              "threads",
              "discussion",
            ]),
          ]
        : []),
      ...(openVersions
        ? [
            action("open-versions", t.versionHistory, History, "tools", openVersions, [
              "history",
              "versions",
              "restore",
            ]),
          ]
        : []),
      ...(openImport
        ? [
            action("open-import", t.importFile, Upload, "tools", openImport, [
              "import",
              "upload",
              "docx",
              "pdf",
              "markdown",
            ]),
          ]
        : []),
      ...(exportAs
        ? EXPORT_FORMATS.map(({ format, label }) =>
            action(
              `export-${format}`,
              `${t.exportAs} ${t[label]}`,
              Download,
              "tools",
              () => exportAs(format),
              ["export", "download", format, t[label].toLowerCase()],
            ),
          )
        : []),
      action("insert-emoji", "Emoji", Smile, "media", () =>
        insertEmojiTrigger(editor),
      ["emoji", "emoticon", "smile"]),
      action("insert-link", t.insertLink, LinkIcon, "format", () => {
        setLinkText("");
        setLinkUrl("https://");
        editor.update(() => {
          const selection = $getSelection();
          setLinkSelection($isRangeSelection(selection) ? selection.clone() : null);
        });
        setLinkOpen(true);
      }, ["link", "url", "hyperlink"]),
      ...ALIGNMENTS.map(({ format, labelKey, icon }) =>
        action(`align-${format}`, t[labelKey], icon, "alignment", () =>
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, format),
        ),
      ),
      action("outdent", t.outdent, IndentDecrease, "alignment", () =>
        editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined),
      ),
      action("indent", t.indent, IndentIncrease, "alignment", () =>
        editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined),
      ),
    ];
  }, [
    editor,
    openComments,
    exportAs,
    openImport,
    openVersions,
    showComments,
    t,
  ]);

  useComponentPickerItems(items);

  const insertLink = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = linkUrl.trim();
    if (!validateUrl(url) || url === "https://") return;
    const normalizedUrl = url.startsWith("www.") ? `https://${url}` : url;
    editor.update(() => {
      if (linkSelection) $setSelection(linkSelection.clone());
      const selection = $getSelection() ?? $getRoot().selectEnd();
      if (!$isRangeSelection(selection)) return;
      const link = $createLinkNode(normalizedUrl);
      link.append($createTextNode(linkText.trim() || url));
      selection.insertNodes([link]);
      link.selectNext();
    });
    setLinkOpen(false);
    requestAnimationFrame(() => editor.focus());
  };

  return (
    <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.insertLink}</DialogTitle>
          <DialogDescription className="sr-only">
            Enter the link text and URL.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={insertLink} className="space-y-4">
          <Input
            aria-label="Link text"
            placeholder="Link text"
            value={linkText}
            onChange={(event) => setLinkText(event.target.value)}
          />
          <Input
            aria-label={t.linkUrlPlaceholder}
            placeholder={t.linkUrlPlaceholder}
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
          />
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                !validateUrl(linkUrl.trim()) || linkUrl.trim() === "https://"
              }
            >
              {t.insertLink}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
