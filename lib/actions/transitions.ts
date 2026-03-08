import { InvalidActionTransitionError } from "@/lib/actions/errors";
import { canTransitionStatus, type ActionStatus } from "@/lib/utils/status";

export function assertActionTransition(
  currentStatus: ActionStatus,
  nextStatus: ActionStatus,
) {
  if (!canTransitionStatus(currentStatus, nextStatus)) {
    throw new InvalidActionTransitionError(currentStatus, nextStatus);
  }
}
