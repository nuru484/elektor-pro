import { Badge } from "./badge";

type Variant = "brand" | "default" | "destructive" | "outline" | "success" | "warning";

const MAP: Record<string, Variant> = {
  APPLIED: "success",
  APPROVED: "success",
  ARCHIVED: "outline",
  CANCELLED: "destructive",
  DISQUALIFIED: "destructive",
  DRAFT: "outline",
  ENDED: "default",
  FAILED: "destructive",
  IN_PROGRESS: "success",
  PAUSED: "warning",
  PENDING: "warning",
  QUALIFIED: "success",
  REJECTED: "destructive",
  SCHEDULED: "brand",
  UNDER_REVIEW: "warning",
  WITHDRAWN: "outline",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={MAP[status] ?? "default"}>
      {status.replace(/_/g, " ").toLowerCase()}
    </Badge>
  );
}
