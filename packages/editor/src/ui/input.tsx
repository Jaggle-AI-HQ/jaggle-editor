import * as React from "react";

import { Loading03Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useDebounce } from "../lib/use-debounce";

import { cn } from "../lib/utils";

interface InputProps extends React.ComponentProps<"input"> {
  variant?: "default" | "minimal";
  usage?: "default" | "search";
  /** Callback fired with debounced value (only when usage="search") */
  onSearchChange?: (value: string) => void;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
  /** Shows a loading spinner instead of the search icon */
  isLoading?: boolean;
}

function Input({
  className,
  type,
  variant = "default",
  usage = "default",
  onSearchChange,
  debounceMs = 300,
  isLoading = false,
  ...props
}: InputProps) {
  const [internalValue, setInternalValue] = React.useState(
    (props.defaultValue as string) ?? "",
  );
  const isControlled = props.value !== undefined;
  const inputValue = isControlled ? (props.value as string) : internalValue;

  const debouncedValue = useDebounce(inputValue, debounceMs);

  React.useEffect(() => {
    if (usage === "search" && onSearchChange) {
      onSearchChange(debouncedValue);
    }
  }, [debouncedValue, onSearchChange, usage]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) {
      setInternalValue(e.target.value);
    }
    props.onChange?.(e);
  };

  const inputElement = (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base styles
        "flex h-9 w-full min-w-0 rounded-lg px-3 py-1 outline-none transition-[border-color,box-shadow,background-color]",
        // Variant-specific styles
        variant === "default" && [
          "border border-border/70 bg-background shadow-none",
          "hover:border-primary/50",
          "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        ],
        variant === "minimal" && [
          "border bg-muted/30 shadow-none",
          "border-muted-foreground/10 dark:bg-muted/20 dark:border-muted-foreground/20",
          "hover:border-muted-foreground/20 hover:bg-muted/40 dark:hover:bg-muted/30 dark:hover:border-muted-foreground/30",
          "focus-visible:border-primary focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/15 dark:focus-visible:bg-muted/40",
          "aria-invalid:border-destructive/30 aria-invalid:bg-destructive/5 aria-invalid:ring-destructive/10 dark:aria-invalid:bg-destructive/10 dark:aria-invalid:ring-destructive/20",
        ],
        // Common styles
        "placeholder:text-muted-foreground/50",
        "selection:bg-primary selection:text-primary-foreground",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-base file:font-medium",
        // Search usage padding - more space when loading
        usage === "search" && (isLoading ? "pl-10" : "pl-9"),
        className,
      )}
      {...props}
      onChange={handleChange}
    />
  );

  if (usage === "search") {
    return (
      <div className="relative">
        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-4 w-4">
          {isLoading ? (
            <HugeiconsIcon icon={Loading03Icon} aria-hidden="true" className="h-4 w-4 text-muted-foreground animate-spin" />
          ) : (
            <HugeiconsIcon icon={Search01Icon} aria-hidden="true" className="h-4 w-4 text-muted-foreground pointer-events-none" />
          )}
        </div>
        {inputElement}
      </div>
    );
  }

  return inputElement;
}

export { Input };
