export function formatActionType(actionType: string): string {
  return actionType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function formatTimestamp(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMicrodollars(microdollars: number): string {
  const dollars = microdollars / 1_000_000;
  if (dollars >= 0.01 || dollars === 0) return `$${dollars.toFixed(2)}`;
  return `$${dollars.toFixed(4).replace(/0+$/, "")}`;
}

export function formatTokens(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "--";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function budgetHealthColor(spent: number, limit: number): string {
  if (limit <= 0) return "bg-primary";
  const pct = (spent / limit) * 100;
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-primary";
}

export function formatExpiresAt(expiresAt: string | null): string | null {
  if (!expiresAt) return null;

  const expires = new Date(expiresAt);
  const now = new Date();
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs <= 0) return "Expired";

  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMin / 60);

  if (diffMin < 1) return "Expires in <1 min";
  if (diffMin < 60) return `Expires in ${diffMin} min`;
  if (diffHour < 24) return `Expires in ${diffHour}h ${diffMin % 60}m`;
  return `Expires in ${Math.floor(diffHour / 24)}d`;
}
