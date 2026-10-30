export const MENTION_ENTITY_TYPES = [
  "user",
  "document",
  "project",
  "task",
  "goal",
  "file",
  "report",
  "sprint",
] as const;

export type MentionEntityType = (typeof MENTION_ENTITY_TYPES)[number];

export type MentionResult = {
  entityType: MentionEntityType;
  entityId: string;
  title: string;
  href?: string;
  /** People only: their photo in the menu. */
  avatarUrl?: string;
};
