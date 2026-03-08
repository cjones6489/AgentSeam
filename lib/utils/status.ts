export const ACTION_TYPES = [
  "send_email",
  "http_post",
  "http_delete",
  "shell_command",
  "db_write",
  "file_write",
  "file_delete",
] as const;

export const ACTION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "expired",
  "executing",
  "executed",
  "failed",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const TERMINAL_ACTION_STATUSES: ReadonlySet<ActionStatus> = new Set([
  "rejected",
  "expired",
  "executed",
  "failed",
]);

const ALLOWED_TRANSITIONS: Record<ActionStatus, readonly ActionStatus[]> = {
  pending: ["approved", "rejected", "expired"],
  approved: ["executing"],
  rejected: [],
  expired: [],
  executing: ["executed", "failed"],
  executed: [],
  failed: [],
};

export function canTransitionStatus(
  currentStatus: ActionStatus,
  nextStatus: ActionStatus,
): boolean {
  return ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function isTerminalActionStatus(status: ActionStatus): boolean {
  return TERMINAL_ACTION_STATUSES.has(status);
}
