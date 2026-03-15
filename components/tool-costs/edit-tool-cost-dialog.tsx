"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpsertToolCost, useDeleteToolCost } from "@/lib/queries/tool-costs";
import { formatMicrodollars } from "@/lib/utils/format";
import type { ToolCostResponse } from "@/lib/validations/tool-costs";

interface EditToolCostDialogProps {
  toolCost: ToolCostResponse | null;
  onClose: () => void;
}

export function EditToolCostDialog({ toolCost, onClose }: EditToolCostDialogProps) {
  const upsert = useUpsertToolCost();
  const deleteMutation = useDeleteToolCost();

  const [costDollars, setCostDollars] = useState(
    toolCost ? (toolCost.costMicrodollars / 1_000_000).toString() : "",
  );

  if (!toolCost) return null;

  const annotations = toolCost.annotations as Record<string, boolean | undefined> | null;
  const defaultTierCost = computeDefaultTierCost(annotations);

  function handleSave() {
    const dollars = parseFloat(costDollars);
    if (isNaN(dollars) || dollars < 0) {
      toast.error("Enter a valid cost amount");
      return;
    }

    upsert.mutate(
      {
        serverName: toolCost!.serverName,
        toolName: toolCost!.toolName,
        costMicrodollars: Math.round(dollars * 1_000_000),
      },
      {
        onSuccess: () => {
          toast.success("Tool cost updated");
          onClose();
        },
        onError: (err) => toast.error(err.message || "Failed to update tool cost"),
      },
    );
  }

  function handleResetToDefault() {
    deleteMutation.mutate(toolCost!.id, {
      onSuccess: () => {
        toast.success("Reset to default tier cost");
        onClose();
      },
      onError: (err) => toast.error(err.message || "Failed to reset tool cost"),
    });
  }

  return (
    <Dialog open={!!toolCost} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogTitle>Edit Tool Cost</DialogTitle>
        <DialogDescription>
          Set a custom cost for{" "}
          <span className="font-medium text-foreground">{toolCost.toolName}</span>{" "}
          on server{" "}
          <span className="font-medium text-foreground">{toolCost.serverName}</span>.
        </DialogDescription>

        <div className="space-y-4">
          {annotations && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Annotations</Label>
              <div className="flex flex-wrap gap-1.5">
                {annotations.readOnlyHint && (
                  <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[11px] text-blue-400">readOnly</span>
                )}
                {annotations.destructiveHint && (
                  <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[11px] text-red-400">destructive</span>
                )}
                {annotations.openWorldHint && (
                  <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-400">openWorld</span>
                )}
                {annotations.openWorldHint === false && (
                  <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[11px] text-green-400">local</span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Default tier cost</Label>
            <p className="text-sm tabular-nums text-foreground">{formatMicrodollars(defaultTierCost)}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tool-cost-input" className="text-xs text-muted-foreground">
              Custom cost
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
              <Input
                id="tool-cost-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.01"
                value={costDollars}
                onChange={(e) => setCostDollars(e.target.value)}
                className="h-9 border-border/50 bg-background pl-7 text-[13px] tabular-nums placeholder:text-muted-foreground/50"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          {toolCost.source === "manual" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToDefault}
              disabled={deleteMutation.isPending}
              className="mr-auto"
            >
              {deleteMutation.isPending ? "Resetting..." : "Reset to Default"}
            </Button>
          )}
          <DialogClose
            className="inline-flex h-8 items-center justify-center rounded-md border border-border/50 bg-secondary px-3 text-xs font-medium text-foreground hover:bg-accent"
          >
            Cancel
          </DialogClose>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={upsert.isPending || costDollars.trim() === ""}
          >
            {upsert.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function computeDefaultTierCost(annotations: Record<string, boolean | undefined> | null): number {
  if (!annotations) return 10_000; // TIER_READ

  if (annotations.readOnlyHint && annotations.openWorldHint === false) return 0; // TIER_FREE
  if (annotations.destructiveHint && annotations.openWorldHint) return 100_000; // TIER_WRITE

  return 10_000; // TIER_READ
}
