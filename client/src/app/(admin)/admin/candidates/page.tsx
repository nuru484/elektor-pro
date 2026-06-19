"use client";

import { ListChecks, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { TableRowsSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  useCreateCandidateMutation,
  useGetElectionQuery,
  useListCandidatesQuery,
  useListElectionsQuery,
} from "@/redux/admin-api";

export default function CandidatesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [electionId, setElectionId] = useState("");

  const { data, isError, isFetching } = useListCandidatesQuery({ limit: 10, page, search });
  const { data: elections } = useListElectionsQuery({ limit: 100 });
  const { data: election } = useGetElectionQuery(electionId, { skip: !electionId });
  const [createCandidate, { isLoading: creating }] = useCreateCandidateMutation();

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const res = await createCandidate({
        electionId: f.get("electionId"),
        manifesto: f.get("manifesto") || undefined,
        name: f.get("name"),
        party: f.get("party") || undefined,
        portfolioId: f.get("portfolioId"),
      }).unwrap();
      setOpen(false);
      toast.success((res as { pending?: boolean }).pending ? "Submitted for approval" : "Candidate added");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        action={<Button onClick={() => setOpen(true)} variant="brand"><Plus className="size-4" /> Add candidate</Button>}
        description="Candidates contesting across your elections."
        title="Candidates"
      />

      <Input
        className="sm:max-w-xs"
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search candidates…"
        value={search}
      />

      <Card className="overflow-hidden">
        {isFetching ? (
          <TableRowsSkeleton cols={3} />
        ) : isError ? (
          <div className="p-4"><ErrorState /></div>
        ) : data && data.data.length > 0 ? (
          <div className="divide-y divide-border">
            {data.data.map((c) => (
              <div className="flex items-center justify-between gap-3 p-4" key={c.id}>
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.portfolio?.name}{c.party ? ` · ${c.party}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4"><EmptyState icon={ListChecks} title="No candidates yet" /></div>
        )}
      </Card>

      {data && <Pagination meta={data.meta} onPageChange={setPage} />}

      <Modal onClose={() => setOpen(false)} open={open} title="Add candidate">
        <form className="space-y-4" onSubmit={onCreate}>
          <Field label="Election">
            <Select name="electionId" onChange={(e) => setElectionId(e.target.value)} required value={electionId}>
              <option value="">Select election…</option>
              {elections?.data.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </Field>
          <Field label="Portfolio">
            <Select name="portfolioId" required>
              <option value="">Select portfolio…</option>
              {election?.data.portfolios?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Full name">
            <Input name="name" placeholder="Candidate name" required />
          </Field>
          <Field label="Party / affiliation">
            <Input name="party" placeholder="Optional" />
          </Field>
          <Field label="Manifesto">
            <Textarea name="manifesto" placeholder="Optional" />
          </Field>
          <Button className="w-full" loading={creating} type="submit" variant="brand">Add candidate</Button>
        </form>
      </Modal>
    </div>
  );
}
