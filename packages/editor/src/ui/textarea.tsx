import * as React from "react";

import { cn } from "../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Base styles
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-border/70 bg-background px-3 py-2 shadow-none outline-none transition-[border-color,box-shadow,background-color]",
        // Placeholder
        "placeholder:text-muted-foreground/50",
        // Hover state
        "hover:border-primary/50",
        // Focus state
        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15",
        // Invalid state
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        // Disabled state
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
