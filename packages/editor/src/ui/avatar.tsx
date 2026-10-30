"use client";

import * as React from "react";

import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "../lib/utils";

/**
 * Background + text pairs for avatar fallbacks (and assignee chips). The 700 shades keep
 * white initials at 4.5:1 or better in both themes.
 */
export const AVATAR_FALLBACK_PALETTE = [
  "bg-violet-700 text-white",
  "bg-sky-700 text-white",
  "bg-teal-700 text-white",
  "bg-emerald-700 text-white",
  "bg-amber-700 text-white",
  "bg-orange-700 text-white",
  "bg-rose-700 text-white",
  "bg-fuchsia-700 text-white",
] as const;

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function collectText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number")
    return String(node);
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return collectText(props.children);
  }
  return "";
}

/** Stable palette class for a string (e.g. user id or initials). */
export function getAvatarFallbackPaletteClass(seed: string): string {
  const i = hashString(seed) % AVATAR_FALLBACK_PALETTE.length;
  return AVATAR_FALLBACK_PALETTE[i]!;
}

function Avatar({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: "default" | "sm" | "lg";
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full align-middle ring-1 ring-border/40 select-none data-[size=lg]:size-10 data-[size=sm]:size-6",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  alt = "",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      alt={alt}
      className={cn("size-full aspect-square object-cover", className)}
      {...props}
    />
  );
}

type AvatarFallbackProps = React.ComponentProps<
  typeof AvatarPrimitive.Fallback
> & {
  /** Stable seed for color (e.g. user id). If omitted, derived from `children` text. */
  seed?: string;
  /** Force a palette index (0 … palette length − 1). Overrides automatic pick. */
  paletteIndex?: number;
};

function AvatarFallback({
  className,
  children,
  seed: seedProp,
  paletteIndex: paletteIndexProp,
  ...props
}: AvatarFallbackProps) {
  const text = collectText(children);
  const seed = (seedProp ?? (text || "avatar")).trim() || "avatar";
  const paletteClass =
    paletteIndexProp != null
      ? AVATAR_FALLBACK_PALETTE[
          Math.abs(paletteIndexProp) % AVATAR_FALLBACK_PALETTE.length
        ]!
      : getAvatarFallbackPaletteClass(seed);

  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full p-0.5 text-center text-[0.857rem]/[1.4] font-semibold leading-none tracking-tight",
        paletteClass,
        className,
      )}
      {...props}
    >
      {children}
    </AvatarPrimitive.Fallback>
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "bg-primary text-primary-foreground ring-background absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full ring-2 select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "*:data-[slot=avatar]:ring-background group/avatar-group flex items-center -space-x-2 *:data-[slot=avatar]:ring-2",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "bg-muted text-muted-foreground ring-background relative flex size-8 shrink-0 items-center justify-center rounded-full p-0.5 text-center text-[0.857rem]/[1.4] font-semibold leading-none tracking-tight ring-2 group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className,
      )}
      {...props}
    />
  );
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
};
