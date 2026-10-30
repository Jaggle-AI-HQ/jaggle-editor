import { useMemo, type ReactNode } from "react";

import {
  KanbanIcon,
  NewTwitterIcon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $getSelection } from "lexical";
import {
  Heading1,
  Heading2,
  Heading3,
  ListTodo,
  Radical,
} from "lucide-react";

import { INSERT_EQUATION_COMMAND } from "../../extensions/equation";
import { INSERT_POLL_COMMAND } from "../../extensions/poll";
import { useTranslation } from "../../lib/locale";
import { applyDocumentBlock, type BlockId } from "../../lib/slash-items";

import {
  type ComponentPickerItem,
  useComponentPickerItems,
} from "./component-picker-plugin";

function useBlockItems(
  entries: { id: BlockId; label: string; icon: ReactNode; keywords: string[] }[],
) {
  const [editor] = useLexicalComposerContext();
  const items = useMemo<ComponentPickerItem[]>(
    () =>
      entries.map(({ id, label, icon, keywords }) => ({
        value: id,
        label,
        icon,
        keywords,
        onSelect: () => applyDocumentBlock(editor, id),
      })),
    [editor, entries],
  );
  useComponentPickerItems(items);
}

export function ToggleHeadingPickerPlugin() {
  const entries = useMemo(
    () =>
      ([
        ["toggle-h1", <Heading1 key="h1" className="text-muted-foreground" />],
        ["toggle-h2", <Heading2 key="h2" className="text-muted-foreground" />],
        ["toggle-h3", <Heading3 key="h3" className="text-muted-foreground" />],
      ] as const).map(([id, icon], index) => ({
        id,
        label: `Toggle heading ${index + 1}`,
        icon,
        keywords: ["toggle", "heading", "collapse", `h${index + 1}`],
      })),
    [],
  );
  useBlockItems(entries);
  return null;
}

export function PollPickerPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();

  const items = useMemo<ComponentPickerItem[]>(
    () => [
      {
        value: "poll",
        label: t.insertPoll,
        icon: <ListTodo className="text-muted-foreground" />,
        keywords: ["poll", "vote", "survey", "question"],
        onSelect: () => {
          editor.update(() => {
            if (!$getSelection()) {
              $getRoot().selectEnd();
            }
          });
          editor.dispatchCommand(INSERT_POLL_COMMAND, "");
        },
      },
    ],
    [editor, t],
  );

  useComponentPickerItems(items);
  return null;
}

export function BoardPickerPlugin() {
  const { t } = useTranslation();
  const entries = useMemo(
    () => [
      {
        id: "board" as const,
        label: t.insertBoard,
        icon: (
          <HugeiconsIcon
            icon={KanbanIcon}
            size={20}
            className="text-muted-foreground"
            aria-hidden="true"
          />
        ),
        keywords: ["board", "kanban", "columns", "cards", "tasks"],
      },
    ],
    [t],
  );
  useBlockItems(entries);
  return null;
}

export function EquationPickerPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();

  const items = useMemo<ComponentPickerItem[]>(
    () => [
      {
        value: "equation",
        label: t.insertEquation,
        icon: <Radical className="text-muted-foreground" />,
        keywords: ["equation", "math", "latex", "katex", "tex"],
        onSelect: () => {
          editor.update(() => {
            if (!$getSelection()) {
              $getRoot().selectEnd();
            }
          });
          editor.dispatchCommand(INSERT_EQUATION_COMMAND, {
            equation: "",
            inline: false,
          });
        },
      },
    ],
    [editor, t],
  );

  useComponentPickerItems(items);
  return null;
}

export function TweetPickerPlugin() {
  const { t } = useTranslation();
  const entries = useMemo(
    () => [
      {
        id: "tweet" as const,
        label: t.insertTweet,
        icon: (
          <HugeiconsIcon
            icon={NewTwitterIcon}
            size={20}
            className="text-muted-foreground"
            aria-hidden="true"
          />
        ),
        keywords: ["tweet", "twitter", "x", "post", "embed"],
      },
    ],
    [t],
  );
  useBlockItems(entries);
  return null;
}

export function YouTubePickerPlugin() {
  const { t } = useTranslation();
  const entries = useMemo(
    () => [
      {
        id: "youtube" as const,
        label: t.insertYoutube,
        icon: (
          <HugeiconsIcon
            icon={YoutubeIcon}
            size={20}
            className="text-muted-foreground"
            aria-hidden="true"
          />
        ),
        keywords: ["youtube", "video", "yt", "embed"],
      },
    ],
    [t],
  );
  useBlockItems(entries);
  return null;
}
