"use client";

import { SearchIcon } from "lucide-react";
import { useCommandPalette } from "./command-palette-context";

export function CommandTrigger() {
  const { setOpen } = useCommandPalette();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex h-7 items-center gap-2 rounded-md border border-border/50 bg-secondary/50 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <SearchIcon className="h-3 w-3" />
      <span className="hidden sm:inline">Search...</span>
      <kbd className="pointer-events-none hidden h-4 select-none items-center rounded border border-border/50 bg-background px-1 font-mono text-[10px] text-muted-foreground/60 sm:inline-flex">
        ⌘K
      </kbd>
    </button>
  );
}
