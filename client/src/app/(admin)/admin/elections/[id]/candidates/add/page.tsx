"use client";

// Allocate existing candidates (people already in the system) to a portfolio
// in THIS election - the same person contesting again without retyping their
// details. A few allocatable people are shown right away; the search narrows
// them down. Saving returns to the election's Candidates tab.
import { ArrowLeft, Plus, UserRoundPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";

import type { Candidate } from "@/types/api";

import { EntityAvatar } from "@/components/console/entity-avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/states";
import { useDebounce } from "@/hooks/use-debounce";
import {
  useAllocateCandidatesMutation,
  useGetElectionQuery,
  useListCandidatesQuery,
} from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

function CandidateRow({
  candidate,
  onPick,
}: {
  candidate: Candidate;
  onPick: (candidate: Candidate) => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
      onClick={() => {
        onPick(candidate);
      }}
      title="Add this person to the selection"
      type="button"
    >
      <EntityAvatar
        name={candidate.name}
        size="size-6"
        url={candidate.profilePicture}
      />
      <span className="min-w-0 truncate">{candidate.name}</span>
      <span className="ml-auto min-w-0 max-w-[45%] truncate text-xs text-muted-foreground">
        {candidate.election?.name ?? ""}
      </span>
      <Plus className="size-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}

export default function AllocateCandidatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: electionId } = use(params);
  const router = useRouter();
  const [allocate, { isLoading: saving }] = useAllocateCandidatesMutation();

  const [portfolioId, setPortfolioId] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 400);
  const [selected, setSelected] = useState<Candidate[]>([]);

  const { data: electionData } = useGetElectionQuery(electionId);
  const portfolios = electionData?.data.portfolios ?? [];

  // People not yet contesting in this election: a first page right away,
  // narrowed by the search.
  const { data: candidatesData, isFetching } = useListCandidatesQuery({
    excludeElectionId: electionId,
    limit: 8,
    ...(debouncedSearch.length >= 2 ? { search: debouncedSearch } : {}),
  });
  const offered = (candidatesData?.data ?? []).filter(
    (candidate) => !selected.some((s) => s.id === candidate.id),
  );

  const save = async () => {
    if (!portfolioId) {
      toast.error("Pick the portfolio they will contest");
      return;
    }
    if (selected.length === 0) {
      toast.error("Select at least one person to allocate");
      return;
    }
    try {
      const res = await allocate({
        candidateIds: selected.map((c) => c.id),
        electionId,
        portfolioId,
      }).unwrap();
      const { added, skipped } = res.data;
      toast.success(
        `${String(added)} allocated${skipped ? `, ${String(skipped)} already contesting here` : ""}`,
      );
      router.push(`/admin/elections/${electionId}/candidates`);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          href={`/admin/elections/${electionId}/candidates`}
        >
          <ArrowLeft className="size-4" /> Back to candidates
        </Link>
        <PageHeader
          description="Assign people already in the system to a portfolio in this election. Their account carries over, so their candidacy history stays linked."
          title="Allocate candidates"
        />
      </div>

      <div className="max-w-2xl space-y-5 sm:rounded-xl sm:border sm:border-border sm:bg-card sm:p-6">
        <Field
          hint="Every selected person is allocated to this portfolio."
          label="Portfolio in this election"
        >
          <NativeSelect
            onChange={(e) => {
              setPortfolioId(e.target.value);
            }}
            title="The portfolio the allocated people will contest"
            value={portfolioId}
          >
            <option value="">Select portfolio…</option>
            {portfolios.map((portfolio) => (
              <option key={portfolio.id} value={portfolio.id}>
                {portfolio.name}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field
          hint="People already contesting in this election are hidden."
          label="Find candidates"
        >
          <div className="relative">
            <Input
              className="pr-9"
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              placeholder="Search by name, or browse below…"
              title="Search existing candidates across all elections"
              value={search}
            />
            {search.length > 0 && (
              <button
                aria-label="Clear search"
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearch("");
                }}
                title="Clear search"
                type="button"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </Field>

        {isFetching ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : (
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-1.5">
            {offered.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">
                {debouncedSearch.length >= 2
                  ? "No matching people outside this election."
                  : "Everyone in the system already contests in this election."}
              </p>
            ) : (
              offered.map((candidate) => (
                <CandidateRow
                  candidate={candidate}
                  key={candidate.id}
                  onPick={(picked) => {
                    setSelected((prev) => [...prev, picked]);
                  }}
                />
              ))
            )}
          </div>
        )}
        {(candidatesData?.meta.total ?? 0) > 8 && (
          <p className="text-xs text-muted-foreground">
            Showing the first 8 of {candidatesData?.meta.total} allocatable
            people. Search to find someone specific.
          </p>
        )}

        {selected.length > 0 && (
          <Field label={`Selected (${String(selected.length)})`}>
            <div className="flex flex-wrap gap-1.5">
              {selected.map((candidate) => (
                <button
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs hover:border-destructive/50"
                  key={candidate.id}
                  onClick={() => {
                    setSelected((prev) => prev.filter((c) => c.id !== candidate.id));
                  }}
                  title="Remove from selection"
                  type="button"
                >
                  <span className="min-w-0 truncate">{candidate.name}</span>
                  <span aria-hidden>×</span>
                </button>
              ))}
            </div>
          </Field>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => {
              router.push(`/admin/elections/${electionId}/candidates`);
            }}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button loading={saving} onClick={() => void save()} variant="brand">
            <UserRoundPlus className="size-4" /> Allocate to this election
          </Button>
        </div>
      </div>
    </div>
  );
}
