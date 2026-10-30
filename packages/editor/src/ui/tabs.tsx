"use client";

import * as React from "react";

import { Slot } from "@radix-ui/react-slot";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "../lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

const tabsListClassName = (hasActions: boolean) =>
  cn(
    "inline-flex h-10 min-w-0 items-center gap-1 overflow-x-auto overflow-y-hidden",
    hasActions ? "flex-1" : "w-fit border-b border-border",
  );

function TabsListBar({
  actions,
  children,
}: {
  actions: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="tabs-list-bar"
      className="flex w-full min-w-0 items-center border-b border-border"
    >
      {children}
      {actions != null ? (
        <div
          data-slot="tabs-list-actions"
          className="ml-auto flex shrink-0 items-center self-stretch pr-2"
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}

function TabsList({
  actions,
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & {
  actions?: React.ReactNode;
}) {
  const list = (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(tabsListClassName(actions !== undefined), className)}
      {...props}
    />
  );

  if (actions === undefined) {
    return list;
  }

  return <TabsListBar actions={actions}>{list}</TabsListBar>;
}

const tabsTriggerClassName = cn(
  // Base styles
  "relative inline-flex items-center justify-center gap-1.5 px-4 py-2 font-medium whitespace-nowrap",
  "text-muted-foreground transition-all duration-200",
  // Hover state
  "hover:text-foreground",
  // Focus styles
  "focus-visible:outline-none focus-visible:text-foreground",
  // Active state
  "data-[state=active]:text-primary",
  // Bottom border indicator
  "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent after:transition-colors after:duration-200",
  "data-[state=active]:after:bg-primary",
  // Disabled state
  "disabled:pointer-events-none disabled:opacity-50",
  // SVG icon styles
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
);

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        tabsTriggerClassName,
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
      {...props}
    />
  );
}

/**
 * Tabs that switch pages: a nav of links styled like `TabsList`. Use with `TabsLink`
 * when each tab is its own route and there is no tab panel to control.
 */
function TabsNav({
  actions,
  className,
  ...props
}: React.ComponentProps<"nav"> & { actions?: React.ReactNode }) {
  const nav = (
    <nav
      data-slot="tabs-nav"
      className={cn(tabsListClassName(actions !== undefined), className)}
      {...props}
    />
  );

  if (actions === undefined) {
    return nav;
  }

  return <TabsListBar actions={actions}>{nav}</TabsListBar>;
}

function TabsLink({
  active,
  className,
  ...props
}: React.ComponentProps<typeof Slot> & { active: boolean }) {
  return (
    <Slot
      data-slot="tabs-link"
      data-state={active ? "active" : "inactive"}
      aria-current={active ? "page" : undefined}
      className={cn(tabsTriggerClassName, className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsNav, TabsLink };
