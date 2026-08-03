"use client";

import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { TableRowsSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { useCreateVoterMutation, useListVotersQuery } from "@/redux/admin-api";

export default function VotersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { data, isError, isFetching } = useListVotersQuery({ limit: 12, page, search });
  const [createVoter, { isLoading: creating }] = useCreateVoterMutation();

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const res = await createVoter({
        name: f.get("name"),
        phoneNumber: f.get("phoneNumber") || undefined,
        voterId: f.get("voterId"),
      }).unwrap();
      setOpen(false);
      toast.success((res as { pending?: boolean }).pending ? "Submitted for approval" : "Voter added");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        action={<Button onClick={() => setOpen(true)} variant="brand"><Plus className="size-4" /> Add voter</Button>}
        description="The people eligible to vote in your elections."
        title="Voters"
      />

      <Input
        className="sm:max-w-xs"
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search by name, ID, or phone…"
        value={search}
      />

      <Card className="overflow-hidden">
        {isFetching ? (
          <TableRowsSkeleton cols={3} />
        ) : isError ? (
          <div className="p-4"><ErrorState /></div>
        ) : data && data.data.length > 0 ? (
          <div className="divide-y divide-border">
            {data.data.map((v) => (
              <div className="flex items-center justify-between gap-3 p-4" key={v.id}>
                <div className="min-w-0">
                  <p className="truncate font-medium">{v.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{v.voterId}{v.phoneNumber ? ` · ${v.phoneNumber}` : ""}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {v.groupMemberships?.slice(0, 2).map((g) => (
                    <Badge key={g.group.id} variant="outline">{g.group.name}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4"><EmptyState icon={Users} title="No voters yet" description="Add voters individually or import them in bulk." /></div>
        )}
      </Card>

      {data && <Pagination meta={data.meta} onPageChange={setPage} />}

      <Modal onClose={() => setOpen(false)} open={open} title="Add voter">
        <form className="space-y-4" onSubmit={onCreate}>
          <Field label="Full name"><Input name="name" required /></Field>
          <Field label="Voter ID" hint="Index / membership number"><Input name="voterId" placeholder="e.g. STU1234" required /></Field>
          <Field label="Phone number" hint="Used to send their one-time login code"><Input name="phoneNumber" placeholder="+233…" /></Field>
          <Button className="w-full" loading={creating} type="submit" variant="brand">Add voter</Button>
        </form>
      </Modal>
    </div>
  );
}
