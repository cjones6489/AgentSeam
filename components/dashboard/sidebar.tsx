"use client";

import { Inbox, Clock, Settings, Shield } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/app/inbox", label: "Inbox", icon: Inbox },
  { href: "/app/history", label: "History", icon: Clock },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r border-border/50 bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b border-border/50 px-5">
        <Shield className="h-4 w-4 text-primary" />
        <Link
          href="/app/inbox"
          className="text-sm font-semibold tracking-tight text-foreground"
        >
          AgentSeam
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border/50 p-3">
        <p className="text-[11px] text-muted-foreground/60">v0.1.0</p>
      </div>
    </aside>
  );
}
