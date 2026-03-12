"use client";

import { CommandTrigger } from "./command-trigger";
import { PageTitle } from "./page-title";
import { UserMenu } from "./user-menu";

export function DashboardHeader({ email }: { email: string | null }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border/50 px-6">
      <PageTitle />
      <div className="flex items-center gap-2">
        <CommandTrigger />
        <UserMenu email={email} />
      </div>
    </header>
  );
}
