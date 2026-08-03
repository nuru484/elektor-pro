"use client";

import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { TableRowsSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { useApproveChangeMutation, useListChangeRequestsQuery, useRejectChangeMutation } from "@/redux/admin-api";

export default function ApprovalsPage() {
  const [page, setPage] = useState(1);
  const { data, isError, isFetching } = useListChangeRequestsQuery({ limit: 10, page, status: "PENDING" });
  const [approve, { isLoading: approving }] = useApproveChangeMutation();
  const [reject, { isLoading: rejecting }] = useRejectChangeMutation();

  const act = async (fn: typeof approve, id: string, label: string) => {
    try {
      await fn({ id }).unwrap();
      toast.success(label);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description="Changes proposed by admins. Approve to apply them, or reject with no effect."
        title="Approval queue"
      />

      {isFetching ? (
        <Card className="overflow-hidden"><TableRowsSkeleton cols={3} /></Card>
      ) : isError ? (
        <ErrorState />
      ) : data && data.data.length > 0 ? (
        <>
          <div className="space-y-3">
            {data.data.map((cr) => (
              <Card key={cr.id}>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{cr.action.toLowerCase()}</Badge>
                      <Badge variant="brand">{cr.entity.replace("_", " ").toLowerCase()}</Badge>
                    </div>
                    <p className="font-medium">{cr.summary ?? `${cr.action} ${cr.entity}`}</p>
                    {cr.requestedBy && (
                      <p className="text-xs text-muted-foreground">
                        Requested by {cr.requestedBy.firstName} {cr.requestedBy.lastName}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      loading={rejecting}
                      onClick={() => act(reject, cr.id, "Change rejected")}
                      size="sm"
                      variant="outline"
                    >
                      <XCircle className="size-4" /> Reject
                    </Button>
                    <Button
                      loading={approving}
                      onClick={() => act(approve, cr.id, "Change approved and applied")}
                      size="sm"
                      variant="brand"
                    >
                      <CheckCircle2 className="size-4" /> Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination meta={data.meta} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState description="There are no changes waiting for review." icon={ShieldCheck} title="Nothing to approve" />
      )}
    </div>
  );
}
