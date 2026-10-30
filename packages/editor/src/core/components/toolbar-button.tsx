"use client";

import type { ReactNode } from "react";

import { Button } from "../../ui/button";
import { Toggle } from "../../ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../ui/tooltip";
import { cn } from "../../lib/utils";

export function toolbarPressedClass(pressed: boolean | undefined) {
  return pressed
    ? "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground"
    : undefined;
}

export function ToolbarToggle({
  label,
  pressed,
  onPressed,
  className,
  children,
}: {
  label: string;
  pressed?: boolean;
  onPressed: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          size="sm"
          pressed={pressed}
          aria-label={label}
          className={cn("size-8", toolbarPressedClass(pressed), className)}
          onMouseDown={(event) => event.preventDefault()}
          onPressedChange={onPressed}
        >
          {children}
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function ToolbarIconButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={label}
          aria-pressed={pressed}
          className={toolbarPressedClass(pressed)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
