"use client";

import { useQuery } from "@tanstack/react-query";

import { EDITOR_QUERY_KEY, useEditorAdapters } from "./context";
import type { EditorPerson, MentionScope } from "./types";

/** People in `scope` matching `search`, through the app's `people` adapter. Off while `scope` is null. */
export function usePeopleSearch(scope: MentionScope | null, search: string, limit: number) {
  const { people } = useEditorAdapters();
  return useQuery({
    queryKey: [EDITOR_QUERY_KEY, "people", scope?.type, scope?.id, search, limit],
    queryFn: ({ signal }) => people!.search(scope!, search, { limit, signal }),
    enabled: Boolean(people && scope),
  });
}

/** One person, for a hover card. Off without an id or a `people` adapter. */
export function usePerson(id: string | undefined, workspaceId: string | undefined) {
  const { people } = useEditorAdapters();
  return useQuery({
    queryKey: [EDITOR_QUERY_KEY, "person", workspaceId, id],
    queryFn: ({ signal }) => people!.get(id!, { workspaceId, signal }),
    enabled: Boolean(people && id),
    staleTime: 5 * 60_000,
  });
}

/** How a person is named in the editor: their name, else their email. */
export function personName(person: EditorPerson): string {
  return person.name.trim() || person.email?.trim() || "";
}
