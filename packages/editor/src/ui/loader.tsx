import { Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { cn } from "../lib/utils";

type LoaderProps = {
  className?: string;
};

/** A small muted spinner for one part of the editor. */
export function Loader({ className }: LoaderProps) {
  return (
    <div
      role="status"
      data-loading="true"
      className={cn("grid place-items-center", className)}
    >
      <HugeiconsIcon
        icon={Loading03Icon}
        size={20}
        aria-hidden="true"
        className="animate-spin text-muted-foreground"
      />
      <span className="sr-only">Loading</span>
    </div>
  );
}
