"use client";

import { Plus, Vote } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { TableRowsSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { useCreateElectionMutation, useListElectionsQuery, useSetElectionStatusMutation } from "@/redux/admin-api";

const STATUSES = ["", "DRAFT", "SCHEDULED", "IN_PROGRESS", "PAUSED", "ENDED", "CANCELLED"];

export default function ElectionsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { data, isError, isFetching } = useListElectionsQuery({ limit: 10, page, search, status });
  const [createElection, { isLoading: creating }] = useCreateElectionMutation();
  const [setElectionStatus] = useSetElectionStatusMutation();

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const res = await createElection({
        description: f.get("description") || undefined,
        endDate: f.get("endDate"),
        eligibilityMode: f.get("eligibilityMode"),
        name: f.get("name"),
        resultsPolicy: f.get("resultsPolicy"),
        startDate: f.get("startDate"),
      }).unwrap();
      setOpen(false);
      toast.success(
        (res as { pending?: boolean }).pending
          ? "Election submitted for super-admin approval"
          : "Election created",
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not create election"));
    }
  };

  const changeStatus = async (id: string, next: string) => {
    try {
      const res = await setElectionStatus({ id, status: next }).unwrap();
      toast.success((res as { pending?: boolean }).pending ? "Change submitted for approval" : "Status updated");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not update status"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <Button onClick={() => setOpen(true)} variant="brand">
            <Plus className="size-4" /> New election
          </Button>
        }
        description="Create and manage elections, then open them for voting."
        title="Elections"
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          className="sm:max-w-xs"
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search elections…"
          value={search}
        />
        <Select className="sm:max-w-40" onChange={(e) => { setStatus(e.target.value); setPage(1); }} value={status}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s ? s.replace("_", " ") : "All statuses"}</option>
          ))}
        </Select>
      </div>

      <Card className="overflow-hidden">
        {isFetching ? (
          <TableRowsSkeleton cols={3} />
        ) : isError ? (
          <div className="p-4"><ErrorState /></div>
        ) : data && data.data.length > 0 ? (
          <div className="divide-y divide-border">
            {data.data.map((e) => (
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" key={e.id}>
                <div className="min-w-0">
                  <Link className="font-medium hover:text-brand" href={`/results/${e.slug}`}>
                    {e.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {e._count?.portfolios ?? 0} portfolios · {e._count?.candidates ?? 0} candidates
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={e.status} />
                  <Select
                    className="h-8 w-auto text-xs"
                    onChange={(ev) => changeStatus(e.id, ev.target.value)}
                    value={e.status}
                  >
                    {["DRAFT", "SCHEDULED", "IN_PROGRESS", "PAUSED", "ENDED", "CANCELLED"].map((s) => (
                      <option key={s} value={s}>{s.replace("_", " ")}</option>
                    ))}
                  </Select>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState description="Create your first election to get started." icon={Vote} title="No elections yet" />
          </div>
        )}
      </Card>

      {data && <Pagination meta={data.meta} onPageChange={setPage} />}

      <Modal description="Define the basics. You can add portfolios and candidates next." onClose={() => setOpen(false)} open={open} title="New election">
        <form className="space-y-4" onSubmit={onCreate}>
          <Field label="Election name">
            <Input name="name" placeholder="e.g. SRC General Election 2026" required />
          </Field>
          <Field label="Description">
            <Input name="description" placeholder="Optional summary" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <Input name="startDate" required type="datetime-local" />
            </Field>
            <Field label="End date">
              <Input name="endDate" required type="datetime-local" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Who can vote">
              <Select defaultValue="ALL_VOTERS" name="eligibilityMode">
                <option value="ALL_VOTERS">All registered voters</option>
                <option value="ROLL">Assigned roll only</option>
              </Select>
            </Field>
            <Field label="Results visibility">
              <Select defaultValue="ON_CLOSE" name="resultsPolicy">
                <option value="ON_CLOSE">When election ends</option>
                <option value="LIVE">Live</option>
                <option value="MANUAL">Manual publish</option>
              </Select>
            </Field>
          </div>
          <Button className="w-full" loading={creating} type="submit" variant="brand">
            Create election
          </Button>
        </form>
      </Modal>
    </div>
  );
}
