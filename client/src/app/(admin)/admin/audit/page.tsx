"use client";

import { ScrollText, ShieldCheck, ShieldX } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { TableRowsSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { useListAuditLogsQuery, useVerifyAuditQuery } from "@/redux/admin-api";

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const { data, isError, isFetching } = useListAuditLogsQuery({ limit: 20, page });
  const { data: integrity } = useVerifyAuditQuery();

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          integrity &&
          (integrity.data.valid ? (
            <Badge variant="success"><ShieldCheck className="size-3" /> Chain verified</Badge>
          ) : (
            <Badge variant="destructive"><ShieldX className="size-3" /> Tampered at #{integrity.data.brokenAt}</Badge>
          ))
        }
        description="A tamper-evident, hash-chained record of every action."
        title="Audit trail"
      />

      <Card className="overflow-hidden">
        {isFetching ? (
          <TableRowsSkeleton cols={3} />
        ) : isError ? (
          <div className="p-4"><ErrorState /></div>
        ) : data && data.data.length > 0 ? (
          <div className="divide-y divide-border">
            {data.data.map((log) => (
              <div className="flex items-center justify-between gap-3 px-4 py-3" key={log.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="size-1.5 shrink-0 rounded-full bg-brand" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{log.action}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {log.entity}
                      {log.actor ? ` · ${log.actor.firstName} ${log.actor.lastName}` : " · system"}
                    </p>
                  </div>
                </div>
                <time className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </time>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4"><EmptyState icon={ScrollText} title="No activity yet" /></div>
        )}
      </Card>

      {data && <Pagination meta={data.meta} onPageChange={setPage} />}
    </div>
  );
}
