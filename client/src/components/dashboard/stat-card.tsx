// Dashboard stat tile: label, big value, optional icon and trend chip.
// Values wear text tokens (never series colors); the trend chip is the only
// colored atom, and it always carries a glyph so direction never rides on
// color alone.
import type { LucideIcon } from "lucide-react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { TrendData } from "@/redux/admin-api";
import { cn } from "@/lib/utils";

export function TrendChip({
  trend,
  windowDays,
}: {
  trend: TrendData;
  windowDays: number;
}) {
  const Icon =
    trend.direction === "upward"
      ? TrendingUp
      : trend.direction === "downward"
        ? TrendingDown
        : Minus;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "flex items-center gap-1 font-medium tabular-nums",
          trend.direction === "upward" && "text-success",
          trend.direction === "downward" && "text-destructive",
        )}
      >
        <Icon aria-hidden className="size-3.5 shrink-0" />
        {trend.percentage}%
      </span>
      <span className="whitespace-nowrap">vs previous {windowDays} days</span>
    </p>
  );
}

export function StatCard({
  hint,
  icon: Icon,
  label,
  trend,
  value,
  windowDays,
}: {
  hint?: string;
  icon?: LucideIcon;
  label: string;
  trend?: TrendData;
  value: number | string;
  windowDays?: number;
}) {
  return (
    <Card className="py-0">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-medium tracking-[0.16em] uppercase text-muted-foreground">
              {label}
            </p>
            <p className="font-display mt-1 text-3xl font-medium tabular-nums [overflow-wrap:anywhere]">
              {value}
            </p>
            {hint && (
              <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            )}
          </div>
          {Icon && <Icon aria-hidden className="size-5 shrink-0 text-brand" />}
        </div>
        {trend && windowDays !== undefined && (
          <TrendChip trend={trend} windowDays={windowDays} />
        )}
      </CardContent>
    </Card>
  );
}
