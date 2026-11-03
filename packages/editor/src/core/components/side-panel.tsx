"use client";

import type { ReactNode } from "react";

import { Button } from "../../ui/button";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";
import { cn } from "../../lib/utils";

/**
 * Pieces shared by the document's side panels (comments, version history),
 * so both read as one set: the title row, the filter under it, and the empty
 * state.
 */

export function SidePanelHeader({
  title,
  count,
  children,
}: {
  title: ReactNode;
  count?: number;
  /** Actions at the end of the row. */
  children?: ReactNode;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-background ps-4 pe-2">
      <h2 className="truncate text-[15px] font-semibold">{title}</h2>
      {count ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary tabular-nums">
          {count}
        </span>
      ) : null}
      <div className="ms-auto flex items-center gap-0.5">{children}</div>
    </div>
  );
}

export type SidePanelFilterOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

/** One choice of a few, as a segmented control. */
export function SidePanelFilter<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: SidePanelFilterOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="shrink-0 border-b bg-background px-3 py-2">
      <ToggleGroup
        type="single"
        aria-label={label}
        value={value}
        onValueChange={(next) => {
          // Clicking the chosen one again keeps it chosen.
          if (next) onChange(next as T);
        }}
        spacing={0.5}
        className="w-full rounded-lg bg-muted p-0.5"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className={cn(
              "h-7 min-w-0 flex-1 gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground shadow-none",
              "hover:bg-transparent hover:text-foreground",
              "data-[state=on]:bg-background data-[state=on]:text-foreground",
            )}
          >
            <span className="truncate">{option.label}</span>
            {option.count ? (
              <span className="tabular-nums text-muted-foreground">{option.count}</span>
            ) : null}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export function SidePanelEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  /** A way out, such as clearing a filter. */
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
        {icon}
      </div>
      <p className="mb-1 text-sm font-medium">{title}</p>
      <p className="max-w-60 text-sm text-muted-foreground">{description}</p>
      {action ? (
        <Button type="button" size="sm" variant="outline" className="mt-4 h-7 text-xs" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
