"use client";

import {
  Analytics01Icon,
  ArrowUpRight01Icon,
  Briefcase01Icon,
  CheckListIcon,
  File01Icon,
  Layout02Icon,
  Note01Icon,
  Target01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";


import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../ui/hover-card";
import { usePerson } from "../../adapters/people";

import { useDocumentUi } from "../document/ui-context";

const TYPE_LABELS: Record<string, string> = {
  user: "Person",
  document: "Document",
  project: "Project",
  task: "Task",
  goal: "Goal",
  file: "File",
  report: "Report",
  sprint: "Sprint",
};

const TYPE_ICONS: Record<string, IconSvgElement> = {
  document: Note01Icon,
  project: Briefcase01Icon,
  task: CheckListIcon,
  goal: Target01Icon,
  file: File01Icon,
  report: Analytics01Icon,
  sprint: Layout02Icon,
};

const SAMPLE_DETAILS: Record<string, string> = {
  "user:user-ada": "Product engineer working on the editor experience.",
  "user:user-grace": "Engineering lead focused on collaboration tools.",
  "document:doc-brief": "An overview of the product scope and goals.",
  "project:proj-launch": "A plan for the upcoming product launch.",
  "task:task-spec": "Draft the editor feature and interaction spec.",
  "goal:goal-editor": "Deliver the new Lexical editor experience.",
  "file:file-roadmap": "A PDF outlining the Q3 product priorities.",
};

function initials(value: string) {
  const parts = value.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

/**
 * A mentioned person's card body. It mounts only while the card is open, so
 * the person (current name, email and avatar) loads on hover, not per chip.
 * Until then, or if they can't be loaded, it shows the name saved in the
 * mention and "Person" in place of the email.
 */
function PersonDetails({ userId, title }: { userId: string; title: string }) {
  const { workspaceId } = useDocumentUi();
  const { data: user } = usePerson(userId, workspaceId);
  const name = user?.name.trim() || title;

  return (
    <div className="flex min-w-0 items-center gap-3 p-3">
      {/* Same avatar as people elsewhere in the editor (board assignees). */}
      <Avatar className="size-9 shrink-0">
        {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
        <AvatarFallback seed={userId} className="text-xs font-semibold">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p
          className="line-clamp-2 font-medium leading-snug wrap-break-word text-foreground"
          title={name}
        >
          {name}
        </p>
        {user?.email ? (
          <p className="mt-0.5 truncate text-sm text-muted-foreground" title={user.email}>
            {user.email}
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-muted-foreground">{TYPE_LABELS.user}</p>
        )}
      </div>
    </div>
  );
}

export function MentionChip({
  entityType,
  entityId,
  title,
  href,
}: {
  entityType: string;
  entityId: string;
  title: string;
  href: string;
}) {
  const typeLabel = TYPE_LABELS[entityType] ?? "Mention";
  // Only real details are shown; without them the card is just the header.
  const description = SAMPLE_DETAILS[`${entityType}:${entityId}`];
  const isPerson = entityType === "user";
  const prefixIcon = TYPE_ICONS[entityType] ?? File01Icon;
  // One neutral chip for every type; "@" or the type icon tells them apart.
  const className =
    "mx-0.5 inline-flex max-w-full items-center rounded-md bg-muted px-1 align-middle font-medium text-foreground/85 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const content = (
    <span className="flex min-w-0 max-w-full items-center gap-x-1">
      {isPerson ? (
        <span className="-me-0.5 shrink-0 text-muted-foreground">@</span>
      ) : (
        <HugeiconsIcon
          icon={prefixIcon}
          size={14}
          className="shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      )}
      <span className="truncate">{title}</span>
    </span>
  );

  const trigger = href ? (
    <a
      href={href}
      contentEditable={false}
      aria-label={`${typeLabel}: ${title}`}
      className={className}
      onMouseDown={(event) => event.preventDefault()}
    >
      {content}
    </a>
  ) : (
    <span
      contentEditable={false}
      tabIndex={0}
      aria-label={`${typeLabel}: ${title}`}
      className={className}
    >
      {content}
    </span>
  );

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={8}
        collisionPadding={8}
        // Above popovers (z-[70]): chips also render inside the comment composer.
        className="z-[80] w-72 max-w-[calc(100vw-1rem)] p-0"
      >
        {isPerson ? (
          <PersonDetails userId={entityId} title={title} />
        ) : (
          <div className="flex min-w-0 items-start gap-3 p-3">
            {/* Same icon as the chip, so the card reads as the thing it previews. */}
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/60 text-muted-foreground">
              <HugeiconsIcon icon={prefixIcon} size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className="line-clamp-2 font-medium leading-snug wrap-break-word text-foreground"
                title={title}
              >
                {title}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{typeLabel}</p>
              {description ? (
                <p className="mt-2 line-clamp-3 wrap-break-word text-sm text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        )}
        {href ? (
          <div className="border-t p-1">
            <a
              href={href}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open {typeLabel.toLowerCase()}
              <HugeiconsIcon icon={ArrowUpRight01Icon} size={16} aria-hidden="true" />
            </a>
          </div>
        ) : null}
      </HoverCardContent>
    </HoverCard>
  );
}
