"use client";

import { useMemo, useState } from "react";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Loader } from "../../../ui/loader";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "../../../ui/avatar";
import { Button } from "../../../ui/button";
import { Calendar } from "../../../ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../ui/command";
import { usePeopleSearch, personName } from "../../../adapters/people";
import { useDebounce } from "../../../lib/use-debounce";
import { cn } from "../../../lib/utils";

import { useDocumentUi } from "../../document/ui-context";
import {
  type BoardAssignee,
  boardInitials,
  parseBoardDate,
  toBoardDate,
} from "../../lib/board";
import { useTranslation } from "../../lib/locale";

const MAX_VISIBLE_ASSIGNEES = 3;
const PEOPLE_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

export function BoardAssigneeAvatars({
  assignees,
}: {
  assignees: readonly BoardAssignee[];
}) {
  const visible = assignees.slice(0, MAX_VISIBLE_ASSIGNEES);
  const hidden = assignees.length - visible.length;
  return (
    <AvatarGroup className="-space-x-1.5">
      {visible.map((assignee) => (
        <Avatar key={assignee.id} size="sm" title={assignee.name}>
          {assignee.avatarUrl ? (
            <AvatarImage src={assignee.avatarUrl} alt="" />
          ) : null}
          <AvatarFallback seed={assignee.id} className="text-[10px] font-semibold">
            {boardInitials(assignee.name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {hidden > 0 ? (
        <AvatarGroupCount className="text-[10px] font-semibold">
          +{hidden}
        </AvatarGroupCount>
      ) : null}
    </AvatarGroup>
  );
}

/** Active workspace members matching the debounced search. */
function useBoardPeople(search: string): {
  people: BoardAssignee[];
  isLoading: boolean;
} {
  const { workspaceId } = useDocumentUi();
  const debouncedSearch = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS);
  const { data, isLoading } = usePeopleSearch(
    workspaceId ? { type: "workspace", id: workspaceId } : null,
    debouncedSearch,
    PEOPLE_PAGE_SIZE,
  );

  return useMemo(
    () => ({
      isLoading,
      people: (data ?? []).flatMap((user) => {
        const name = personName(user);
        if (!user.id || !name) {
          return [];
        }
        return [
          user.avatarUrl
            ? { id: user.id, name, avatarUrl: user.avatarUrl }
            : { id: user.id, name },
        ];
      }),
    }),
    [data, isLoading],
  );
}

export function BoardAssigneePicker({
  assignees,
  onToggle,
}: {
  assignees: readonly BoardAssignee[];
  onToggle: (assignee: BoardAssignee) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const { people, isLoading } = useBoardPeople(search);
  const query = search.trim().toLowerCase();

  // Assigned people stay on top while they match the search, even when the
  // current result page does not include them. The API already filtered the rest.
  const assigned = assignees.filter((person) =>
    person.name.toLowerCase().includes(query),
  );
  const others = people.filter(
    (person) => !assignees.some((item) => item.id === person.id),
  );

  const renderPerson = (person: BoardAssignee, checked: boolean) => (
    <CommandItem
      key={person.id}
      value={person.id}
      onSelect={() => onToggle(person)}
    >
      <BoardAssigneeAvatars assignees={[person]} />
      <span className="min-w-0 flex-1 truncate">{person.name}</span>
      <HugeiconsIcon
        icon={Tick02Icon}
        size={16}
        aria-hidden="true"
        className={cn("text-foreground", !checked && "invisible")}
      />
    </CommandItem>
  );

  return (
    <Command shouldFilter={false} className="w-64 rounded-none bg-transparent">
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder={t.boardSearchPeople}
        aria-label={t.boardSearchPeople}
      />
      <CommandList className="max-h-64 overflow-y-auto">
        {isLoading ? (
          <Loader className="py-6 text-[8px]" />
        ) : (
          <CommandEmpty>{t.boardNoPeople}</CommandEmpty>
        )}
        {assigned.length > 0 ? (
          <CommandGroup>
            {assigned.map((person) => renderPerson(person, true))}
          </CommandGroup>
        ) : null}
        {others.length > 0 ? (
          <CommandGroup>
            {others.map((person) => renderPerson(person, false))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  );
}

export function BoardDueDatePicker({
  dueDate,
  onChange,
}: {
  dueDate: string | null;
  onChange: (dueDate: string | null) => void;
}) {
  const { t } = useTranslation();
  const selected = parseBoardDate(dueDate) ?? undefined;
  const [month, setMonth] = useState<Date>(selected ?? new Date());

  return (
    <div className="flex flex-col">
      <Calendar
        mode="single"
        captionLayout="dropdown"
        fixedWeeks={false}
        showOutsideDays={false}
        selected={selected}
        month={month}
        onMonthChange={setMonth}
        onSelect={(date) => onChange(date ? toBoardDate(date) : null)}
        startMonth={new Date(2000, 0)}
        endMonth={new Date(2100, 11)}
        className="p-2.5"
      />
      {dueDate ? (
        <div className="w-0 min-w-full border-t p-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => onChange(null)}
          >
            {t.boardClearDate}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
