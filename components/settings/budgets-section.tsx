"use client";

import { DollarSign, MoreHorizontal, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiKeys } from "@/lib/queries/api-keys";
import {
  useBudgets,
  useCreateBudget,
  useCurrentUserId,
  useDeleteBudget,
  useResetBudget,
} from "@/lib/queries/budgets";
import {
  budgetHealthColor,
  formatMicrodollars,
} from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export function BudgetsSection() {
  const { data, isLoading, error } = useBudgets();
  const { data: keysData } = useApiKeys();
  const [createOpen, setCreateOpen] = useState(false);

  const budgets = data?.data ?? [];
  const keyMap = new Map(
    (keysData?.data ?? []).map((k) => [k.id, k.name]),
  );

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-sm font-medium text-foreground">
            Budgets
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Control spending limits for your account and API keys.
          </p>
        </div>
        <CreateBudgetDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && <BudgetsSkeleton />}

        {error && (
          <div className="p-6 text-sm text-red-400">
            Failed to load budgets.
          </div>
        )}

        {data && budgets.length === 0 && <EmptyBudgets onCreateClick={() => setCreateOpen(true)} />}

        {data && budgets.length > 0 && (
          <>
            <SummaryStats budgets={budgets} />
            <div className="border-t border-border/30">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Entity
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Limit
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Spent
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Reset
                    </TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgets.map((budget) => (
                    <BudgetRow
                      key={budget.id}
                      budget={budget}
                      entityName={
                        budget.entityType === "user"
                          ? "Your Account"
                          : keyMap.get(budget.entityId) ?? budget.entityId.slice(0, 8)
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface BudgetData {
  id: string;
  entityType: string;
  entityId: string;
  maxBudgetMicrodollars: number;
  spendMicrodollars: number;
  resetInterval: string | null;
  currentPeriodStart: string | null;
}

function SummaryStats({ budgets }: { budgets: BudgetData[] }) {
  const totalSpend = budgets.reduce((sum, b) => sum + b.spendMicrodollars, 0);
  const atRisk = budgets.filter((b) => {
    if (b.maxBudgetMicrodollars <= 0) return false;
    return (b.spendMicrodollars / b.maxBudgetMicrodollars) * 100 >= 80;
  }).length;

  return (
    <div className="grid grid-cols-3 gap-3 border-t border-border/30 p-4">
      <StatCard label="Budgets configured" value={String(budgets.length)} />
      <StatCard label="Total spend" value={formatMicrodollars(totalSpend)} />
      <StatCard
        label="At risk"
        value={String(atRisk)}
        className={atRisk > 0 ? "text-amber-400" : undefined}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-border/30 bg-background p-3">
      <p className={cn("text-lg font-semibold tabular-nums text-foreground", className)}>
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function BudgetRow({
  budget,
  entityName,
}: {
  budget: BudgetData;
  entityName: string;
}) {
  const resetBudget = useResetBudget();
  const deleteBudget = useDeleteBudget();
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const pct =
    budget.maxBudgetMicrodollars > 0
      ? Math.min(
          (budget.spendMicrodollars / budget.maxBudgetMicrodollars) * 100,
          100,
        )
      : 0;

  function handleReset() {
    resetBudget.mutate(budget.id, {
      onSuccess: () => {
        setResetOpen(false);
        toast.success("Budget spend reset to $0.00");
      },
      onError: (err) => toast.error(err.message || "Failed to reset budget"),
    });
  }

  function handleDelete() {
    deleteBudget.mutate(budget.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        toast.success("Budget deleted");
      },
      onError: (err) => toast.error(err.message || "Failed to delete budget"),
    });
  }

  const resetLabel = budget.resetInterval
    ? budget.resetInterval.charAt(0).toUpperCase() + budget.resetInterval.slice(1)
    : "--";

  const daysLeft = computeDaysLeft(budget.resetInterval, budget.currentPeriodStart);

  return (
    <TableRow className="border-border/30 transition-colors hover:bg-accent/40">
      <TableCell>
        <div>
          <p className="text-[13px] font-medium text-foreground">{entityName}</p>
          <p className="text-[11px] text-muted-foreground">{budget.entityType}</p>
        </div>
      </TableCell>
      <TableCell className="text-[13px] tabular-nums text-foreground">
        {formatMicrodollars(budget.maxBudgetMicrodollars)}
      </TableCell>
      <TableCell>
        <div className="space-y-1.5">
          <p className="text-[13px] tabular-nums text-foreground">
            {formatMicrodollars(budget.spendMicrodollars)}{" "}
            <span className="text-muted-foreground">
              / {formatMicrodollars(budget.maxBudgetMicrodollars)}
            </span>
          </p>
          <Progress
            value={pct}
            indicatorClassName={budgetHealthColor(
              budget.spendMicrodollars,
              budget.maxBudgetMicrodollars,
            )}
            className="h-1.5 gap-0"
          />
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {Math.round(pct)}%
          </p>
        </div>
      </TableCell>
      <TableCell>
        <div>
          <p className="text-xs text-foreground">{resetLabel}</p>
          {daysLeft !== null && (
            <p className="text-[11px] text-muted-foreground">{daysLeft}d left</p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={`Actions for budget "${entityName}"`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setResetOpen(true)}>
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              Reset Spend
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete Budget
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent>
            <DialogTitle>Reset budget spend?</DialogTitle>
            <DialogDescription>
              This will reset the current spend for &ldquo;{entityName}&rdquo; to
              $0.00. This cannot be undone.
            </DialogDescription>
            <DialogFooter>
              <DialogClose
                className="inline-flex h-8 items-center justify-center rounded-md border border-border/50 bg-secondary px-3 text-xs font-medium text-foreground hover:bg-accent"
                disabled={resetBudget.isPending}
              >
                Cancel
              </DialogClose>
              <Button
                size="sm"
                onClick={handleReset}
                disabled={resetBudget.isPending}
              >
                {resetBudget.isPending ? "Resetting..." : "Reset Spend"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogTitle>Delete budget?</DialogTitle>
            <DialogDescription>
              This will permanently remove the budget for &ldquo;{entityName}&rdquo;.
              Spending will no longer be tracked against a limit.
            </DialogDescription>
            <DialogFooter>
              <DialogClose
                className="inline-flex h-8 items-center justify-center rounded-md border border-border/50 bg-secondary px-3 text-xs font-medium text-foreground hover:bg-accent"
                disabled={deleteBudget.isPending}
              >
                Cancel
              </DialogClose>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteBudget.isPending}
              >
                {deleteBudget.isPending ? "Deleting..." : "Delete Budget"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}

function CreateBudgetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createBudget = useCreateBudget();
  const { data: userId } = useCurrentUserId();
  const { data: keysData } = useApiKeys();
  const keys = keysData?.data ?? [];

  const [entityType, setEntityType] = useState<"user" | "api_key">("user");
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [limitDollars, setLimitDollars] = useState("");
  const [resetInterval, setResetInterval] = useState<string>("none");

  function resetForm() {
    setEntityType("user");
    setSelectedKeyId("");
    setLimitDollars("");
    setResetInterval("none");
  }

  function handleCreate() {
    const dollars = parseFloat(limitDollars);
    if (isNaN(dollars) || dollars <= 0) {
      toast.error("Enter a valid budget amount");
      return;
    }

    const entityId =
      entityType === "user" ? userId : selectedKeyId;

    if (!entityId) {
      toast.error(
        entityType === "user"
          ? "Could not determine your user ID"
          : "Select an API key",
      );
      return;
    }

    createBudget.mutate(
      {
        entityType,
        entityId,
        maxBudgetMicrodollars: Math.round(dollars * 1_000_000),
        resetInterval:
          resetInterval === "none"
            ? undefined
            : (resetInterval as "daily" | "weekly" | "monthly"),
      },
      {
        onSuccess: () => {
          toast.success("Budget created");
          resetForm();
          onOpenChange(false);
        },
        onError: (err) => toast.error(err.message || "Failed to create budget"),
      },
    );
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  const canSubmit =
    limitDollars.trim() !== "" &&
    parseFloat(limitDollars) > 0 &&
    (entityType === "user" ? !!userId : !!selectedKeyId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Plus className="h-3.5 w-3.5" />
        Set Budget
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Set Budget</DialogTitle>
        <DialogDescription>
          Set a spending limit for your account or an individual API key.
        </DialogDescription>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Budget for</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEntityType("user")}
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                  entityType === "user"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                Your Account
              </button>
              <button
                type="button"
                onClick={() => setEntityType("api_key")}
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                  entityType === "api_key"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                API Key
              </button>
            </div>
          </div>

          {entityType === "api_key" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">API Key</Label>
              {keys.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No API keys available. Create a key first.
                </p>
              ) : (
                <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a key..." />
                  </SelectTrigger>
                  <SelectContent>
                    {keys.map((key) => (
                      <SelectItem key={key.id} value={key.id}>
                        {key.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="budget-limit" className="text-xs text-muted-foreground">
              Monthly limit
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
                $
              </span>
              <Input
                id="budget-limit"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="100.00"
                value={limitDollars}
                onChange={(e) => setLimitDollars(e.target.value)}
                className="h-9 border-border/50 bg-background pl-7 text-[13px] tabular-nums placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Reset interval</Label>
            <Select value={resetInterval} onValueChange={setResetInterval}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (manual reset)</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <DialogClose
            className="inline-flex h-8 items-center justify-center rounded-md border border-border/50 bg-secondary px-3 text-xs font-medium text-foreground hover:bg-accent"
          >
            Cancel
          </DialogClose>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!canSubmit || createBudget.isPending}
          >
            {createBudget.isPending ? "Creating..." : "Set Budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyBudgets({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 border-t border-border/30 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/50">
        <DollarSign className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No budgets configured</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Set spending limits for your account or individual API keys.
        </p>
      </div>
      <Button size="sm" onClick={onCreateClick}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Set Budget
      </Button>
    </div>
  );
}

function BudgetsSkeleton() {
  return (
    <div className="space-y-2 border-t border-border/30 p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-10 w-full rounded-lg bg-secondary/50" />
          <Skeleton className="h-1.5 w-full rounded-full bg-secondary/50" />
        </div>
      ))}
    </div>
  );
}

function computeDaysLeft(
  resetInterval: string | null,
  currentPeriodStart: string | null,
): number | null {
  if (!resetInterval || !currentPeriodStart) return null;

  const start = new Date(currentPeriodStart);
  const now = new Date();

  let nextReset: Date;
  switch (resetInterval) {
    case "daily":
      nextReset = new Date(start);
      nextReset.setDate(nextReset.getDate() + 1);
      while (nextReset <= now) nextReset.setDate(nextReset.getDate() + 1);
      break;
    case "weekly":
      nextReset = new Date(start);
      nextReset.setDate(nextReset.getDate() + 7);
      while (nextReset <= now) nextReset.setDate(nextReset.getDate() + 7);
      break;
    case "monthly":
      nextReset = new Date(start);
      nextReset.setMonth(nextReset.getMonth() + 1);
      while (nextReset <= now) nextReset.setMonth(nextReset.getMonth() + 1);
      break;
    default:
      return null;
  }

  const diffMs = nextReset.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}
