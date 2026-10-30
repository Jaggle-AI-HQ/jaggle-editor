import data, { type EmojiMartData } from "@emoji-mart/data";

export type EmojiEntry = {
  id: string;
  emoji: string;
  name: string;
  keywords: string[];
};

const mart = data as EmojiMartData;

export const EMOJI_ENTRIES: EmojiEntry[] = Object.values(mart.emojis)
  .map((emoji) => ({
    id: emoji.id,
    emoji: emoji.skins[0]?.native ?? "",
    name: emoji.id,
    keywords: [emoji.name, ...emoji.keywords],
  }))
  .filter((entry) => entry.emoji.length > 0);

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "");
}

export function searchEmojis(query: string): EmojiEntry[] {
  const q = normalize(query);
  if (!q) {
    return EMOJI_ENTRIES;
  }

  const startsWith: EmojiEntry[] = [];
  const includes: EmojiEntry[] = [];

  for (const entry of EMOJI_ENTRIES) {
    const name = normalize(entry.name);
    if (name.startsWith(q)) {
      startsWith.push(entry);
      continue;
    }
    if (entry.keywords.some((keyword) => normalize(keyword).startsWith(q))) {
      startsWith.push(entry);
      continue;
    }
    if (
      name.includes(q) ||
      entry.keywords.some((keyword) => normalize(keyword).includes(q))
    ) {
      includes.push(entry);
    }
  }

  return [...startsWith, ...includes];
}
