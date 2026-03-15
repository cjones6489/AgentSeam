"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMicrodollars, formatDuration } from "@/lib/utils/format";
import type { ToolBreakdown as ToolBreakdownType } from "@/lib/validations/cost-event-summary";

interface ToolBreakdownProps {
  data: ToolBreakdownType[];
}

function parseToolModel(model: string): { server: string; tool: string } {
  const idx = model.indexOf("/");
  if (idx === -1) return { server: "", tool: model };
  return { server: model.slice(0, idx), tool: model.slice(idx + 1) };
}

export function ToolBreakdown({ data }: ToolBreakdownProps) {
  if (data.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/30 bg-card">
      <div className="border-b border-border/30 px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">MCP Tool Calls</h3>
        <p className="text-[11px] text-muted-foreground">
          Cost breakdown by MCP server and tool.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-border/50 hover:bg-transparent">
            <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Tool
            </TableHead>
            <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Calls
            </TableHead>
            <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Avg Duration
            </TableHead>
            <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Cost
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const { server, tool } = parseToolModel(row.model);
            return (
              <TableRow key={row.model} className="border-border/30">
                <TableCell>
                  <p className="text-[13px] font-medium text-foreground">{tool}</p>
                  {server && (
                    <p className="text-[11px] text-muted-foreground">{server}</p>
                  )}
                </TableCell>
                <TableCell className="text-right text-[13px] tabular-nums text-foreground">
                  {row.requestCount.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-[13px] tabular-nums text-muted-foreground">
                  {formatDuration(row.avgDurationMs)}
                </TableCell>
                <TableCell className="text-right text-[13px] tabular-nums text-foreground">
                  {formatMicrodollars(row.totalCostMicrodollars)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
