"use client";

// Election workspace - Overview tab: the at-a-glance state of the election
// with quick links into the other tabs.
import { CalendarClock, CopyPlus, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";

import type { EligibilityMode } from "@/types/api";

import {
  ELIGIBILITY_MODE_HINTS,
  ELIGIBILITY_MODE_LABELS,
} from "@/components/elections/election-lifecycle";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useCloneElectionMutation, useGetElectionQuery } from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

const RESULTS_POLICY_LABELS: Record<string, string> = {
  LIVE: "Live while voting is open",
  MANUAL: "Published manually",
  ON_CLOSE: "Published when the election ends",
};

function StatCard({
  href,
  hint,
  label,
  value,
}: {
  href: string;
  hint: string;
  label: string;
  value: number;
}) {
  return (
    <Link
      className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand/40"
      href={href}
      title={`Open the ${label.toLowerCase()} tab`}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Link>
  );
}

export default function ElectionOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isLoading } = useGetElectionQuery(id);
  const election = data?.data;
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneElection, { isLoading: cloning }] = useCloneElectionMutation();

  const onClone = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const startDate = String(f.get("startDate") ?? "");
    const endDate = String(f.get("endDate") ?? "");
    if (!name || !startDate || !endDate) {
      toast.error("Name, start, and close dates are required");
      return;
    }
    try {
      const res = await cloneElection({
        electionId: id,
        endDate: new Date(endDate).toISOString(),
        name,
        startDate: new Date(startDate).toISOString(),
      }).unwrap();
      if (res.pending) {
        toast.success("Clone submitted for approval");
        setCloneOpen(false);
      } else {
        toast.success("Election cloned as a draft");
        router.push(`/admin/elections/${res.data.id}`);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not clone the election"));
    }
  };

  if (isLoading || !election) {
    return (
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton className="h-28 rounded-xl" key={i} />
        ))}
      </div>
    );
  }

  const base = `/admin/elections/${election.id}`;
  const mode = (election.eligibilityMode ?? "ALL_VOTERS") as EligibilityMode;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
        <StatCard
          hint="Positions on the ballot"
          href={`${base}/portfolios`}
          label="Portfolios"
          value={election._count?.portfolios ?? 0}
        />
        <StatCard
          hint="Contesting across portfolios"
          href={`${base}/candidates`}
          label="Candidates"
          value={election._count?.candidates ?? 0}
        />
        <StatCard
          hint="Voters with a roll entry"
          href={`${base}/voters`}
          label="Roll entries"
          value={election._count?.voterElections ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <UsersRound className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Who can vote</h2>
          </div>
          <p className="mt-2 text-sm font-medium">{ELIGIBILITY_MODE_LABELS[mode]}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ELIGIBILITY_MODE_HINTS[mode]}
          </p>
          {mode === "GROUPS" && (
            // Group names are admin-authored free text - plain list, never
            // badges (long names would burst a pill).
            <ul className="mt-3 space-y-1">
              {(election.eligibilityGroups ?? []).map(({ group }) => (
                <li className="min-w-0 text-sm [overflow-wrap:anywhere]" key={group.id}>
                  {group.name}
                  {group.category && (
                    <span className="text-xs text-muted-foreground"> · {group.category.name}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {mode === "ROLL" && (
            <p className="mt-3 text-xs">
              <Link className="font-medium text-brand hover:underline" href={`${base}/voters`}>
                Manage the roll →
              </Link>
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Accreditation{" "}
            {election.accreditationRequired
              ? "is required before voting."
              : "is not required."}
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Schedule & results</h2>
          </div>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex flex-col gap-0.5 min-[480px]:flex-row min-[480px]:justify-between">
              <dt className="text-muted-foreground">Opens</dt>
              <dd className="font-medium">{new Date(election.startDate).toLocaleString()}</dd>
            </div>
            <div className="flex flex-col gap-0.5 min-[480px]:flex-row min-[480px]:justify-between">
              <dt className="text-muted-foreground">Closes</dt>
              <dd className="font-medium">{new Date(election.endDate).toLocaleString()}</dd>
            </div>
            <div className="flex flex-col gap-0.5 min-[480px]:flex-row min-[480px]:justify-between">
              <dt className="text-muted-foreground">Results</dt>
              <dd className="font-medium">
                {RESULTS_POLICY_LABELS[election.resultsPolicy] ?? election.resultsPolicy}
              </dd>
            </div>
          </dl>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            Scheduled elections open and close automatically at these times; you
            can also change the status manually from the header. Voters are
            notified automatically when voting opens and when results publish.
          </p>
        </section>
      </div>

      {/* Run it again: clone the structure into next year's edition. */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <CopyPlus className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Run this election again</h2>
            <p className="text-xs text-muted-foreground">
              Clone the structure - portfolios, eligibility groups, settings,
              and vetting criteria - into a fresh draft with new dates.
              Candidates and the roll start clean.
            </p>
          </div>
        </div>
        <Button
          className="sm:shrink-0"
          onClick={() => {
            setCloneOpen(true);
          }}
          title="Create next year's edition from this election's structure"
          variant="outline"
        >
          <CopyPlus className="size-4" /> Clone election
        </Button>
      </section>

      <Modal
        description="The clone starts as a draft: adjust anything before scheduling it."
        onClose={() => {
          setCloneOpen(false);
        }}
        open={cloneOpen}
        title="Clone this election"
      >
        <form className="space-y-4" onSubmit={onClone}>
          <Field label="New election name">
            <Input
              defaultValue={`${election.name} (new run)`}
              name="name"
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Opens">
              <Input name="startDate" required type="datetime-local" />
            </Field>
            <Field label="Closes">
              <Input name="endDate" required type="datetime-local" />
            </Field>
          </div>
          <Button className="w-full" loading={cloning} type="submit" variant="brand">
            Create the clone
          </Button>
        </form>
      </Modal>
    </div>
  );
}
