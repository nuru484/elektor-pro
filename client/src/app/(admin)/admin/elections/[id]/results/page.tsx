"use client";

// Election workspace - Results tab: the certification console. Turnout and
// publication state at a glance, the live tally link, exports, and the
// publish / unpublish / certify controls (capability-gated; certification
// asks for a typed confirmation because it locks the election forever).
import {
  Award,
  BarChart3,
  Download,
  ExternalLink,
  EyeOff,
  Megaphone,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useAuthRole } from "@/hooks/use-auth-role";
import { env } from "@/lib/env";
import {
  useCertifyResultsMutation,
  useGetCertificationQuery,
  useGetElectionQuery,
  useGetElectionReportQuery,
  usePublishResultsMutation,
  useUnpublishResultsMutation,
} from "@/redux/admin-api";
import { useGetResultsQuery } from "@/redux/voting-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { formatDateTime } from "@/utils/format-date";

const fmt = (n: number) => n.toLocaleString();

function Tile({ hint, label, value }: { hint?: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** The commission's one-page numbers: accreditation, pipeline, integrity. */
function ReportRow({ electionId }: { electionId: string }) {
  const { data } = useGetElectionReportQuery(electionId);
  const report = data?.data;
  if (!report) return null;
  const totalCandidates = Object.values(report.candidates).reduce((a, b) => a + b, 0);
  return (
    <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
      <Tile
        hint={`of ${fmt(report.turnout.eligible)} eligible voters`}
        label="Accredited"
        value={fmt(report.accredited)}
      />
      <Tile
        hint={`${fmt(report.candidates.QUALIFIED ?? 0)} qualified across ${fmt(report.portfolios)} portfolios`}
        label="Candidates"
        value={fmt(totalCandidates)}
      />
      <Tile
        hint={
          report.chain.valid
            ? `all ${fmt(report.chain.total)} ballots verified`
            : `BROKEN at ballot #${String(report.chain.brokenAt ?? 0)}`
        }
        label="Ballot chain"
        value={report.chain.valid ? "Intact" : "Broken"}
      />
    </div>
  );
}

const POLICY_LABELS: Record<string, string> = {
  LIVE: "Live: signed-in viewers see the running tally",
  MANUAL: "Manual: hidden until results are published here",
  ON_CLOSE: "On close: visible to viewers once the election ends",
};

export default function ElectionResultsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { can } = useAuthRole();
  const canCertify = can("CERTIFY_RESULTS");
  const [confirming, setConfirming] = useState<"certify" | "publish" | "unpublish" | null>(
    null,
  );

  const { data: electionData } = useGetElectionQuery(id);
  const { data, error, isError, isLoading } = useGetResultsQuery(id);
  const election = electionData?.data;
  const results = data?.data;

  const certified = Boolean(election?.certifiedAt);
  const { data: certData } = useGetCertificationQuery(id, { skip: !certified });
  const certification = certData?.data;

  const [publish, { isLoading: publishing }] = usePublishResultsMutation();
  const [unpublish, { isLoading: unpublishing }] = useUnpublishResultsMutation();
  const [certify, { isLoading: certifying }] = useCertifyResultsMutation();

  const run = async (action: "certify" | "publish" | "unpublish") => {
    setConfirming(null);
    try {
      if (action === "publish") {
        await publish(id).unwrap();
        toast.success("Results published - the public page is now open");
      } else if (action === "unpublish") {
        await unpublish(id).unwrap();
        toast.success("Results unpublished - hidden from the public again");
      } else {
        const res = await certify(id).unwrap();
        toast.success(`Results certified. Fingerprint ${res.data.hash.slice(0, 12)}…`);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton className="h-24 rounded-xl" key={i} />
        ))}
      </div>
    );
  }
  if (isError) {
    return <ErrorState message={getApiErrorMessage(error, "Could not load results")} />;
  }
  if (!results) return null;

  const publication = election?.certifiedAt
    ? { hint: formatDateTime(election.certifiedAt), value: "Certified" }
    : election?.resultsPublishedAt
      ? { hint: formatDateTime(election.resultsPublishedAt), value: "Published" }
      : { hint: "Results are not yet public", value: "Not published" };
  const policyLabel = election
    ? (POLICY_LABELS[election.resultsPolicy] ?? election.resultsPolicy)
    : "";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
        <Tile
          hint={`of ${fmt(results.turnout.totalEligible)} eligible`}
          label="Votes cast"
          value={fmt(results.turnout.totalVoted)}
        />
        <Tile label="Turnout" value={`${String(results.turnout.percentage)}%`} />
        <Tile hint={publication.hint} label="Publication" value={publication.value} />
      </div>

      <ReportRow electionId={id} />

      {/* Live tally + exports */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <BarChart3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Live tally and exports</p>
            <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {policyLabel}. Exports carry the full per-portfolio tally for the
              official record.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
          <Button
            onClick={() => {
              window.open(
                `${env.apiUrl}/elections/${id}/results/export?format=csv`,
                "_blank",
              );
            }}
            size="sm"
            title="Download the tally as a CSV spreadsheet"
            variant="outline"
          >
            <Download className="size-4" /> CSV
          </Button>
          <Button
            onClick={() => {
              window.open(
                `${env.apiUrl}/elections/${id}/results/export?format=pdf`,
                "_blank",
              );
            }}
            size="sm"
            title="Download the tally as a PDF document"
            variant="outline"
          >
            <Download className="size-4" /> PDF
          </Button>
          {election && (
            <Link
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              href={`/results/${election.slug}`}
              title="Open the public results page"
            >
              <ExternalLink className="size-3.5" /> Results page
            </Link>
          )}
        </div>
      </div>

      {/* Publication controls */}
      {canCertify && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            <Megaphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Publication</p>
              <p className="text-xs text-muted-foreground">
                Publishing opens the public results page regardless of policy.
                Certification snapshots the tally, fingerprints it, and locks
                the election permanently.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
            {!election?.resultsPublishedAt && (
              <Button
                loading={publishing}
                onClick={() => {
                  setConfirming("publish");
                }}
                size="sm"
                title="Make the results publicly visible now"
                variant="brand"
              >
                <Megaphone className="size-4" /> Publish
              </Button>
            )}
            {election?.resultsPublishedAt && !certified && (
              <Button
                loading={unpublishing}
                onClick={() => {
                  setConfirming("unpublish");
                }}
                size="sm"
                title="Hide the results from the public again"
                variant="outline"
              >
                <EyeOff className="size-4" /> Unpublish
              </Button>
            )}
            {!certified && (
              <Button
                disabled={election?.status !== "ENDED"}
                loading={certifying}
                onClick={() => {
                  setConfirming("certify");
                }}
                size="sm"
                title={
                  election?.status === "ENDED"
                    ? "Snapshot, fingerprint, and permanently lock these results"
                    : "Only an ended election can be certified"
                }
                variant="destructive"
              >
                <Award className="size-4" /> Certify
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Certification record */}
      {certified && (
        <div className="flex items-start gap-2.5 rounded-xl border border-success/40 bg-success/5 p-5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Certified results</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {certification?.certifiedBy
                ? `Certified by ${certification.certifiedBy.firstName} ${certification.certifiedBy.lastName}`
                : "Certified"}
              {certification ? ` on ${formatDateTime(certification.createdAt)}` : ""}. The
              fingerprint below proves this exact tally is the official record.
            </p>
            {certification && (
              <p
                className="mt-2 min-w-0 rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs [overflow-wrap:anywhere]"
                title="SHA-256 fingerprint of the certified snapshot"
              >
                {certification.hash}
              </p>
            )}
          </div>
        </div>
      )}

      <ConfirmationDialog
        confirmText={
          confirming === "certify"
            ? "Certify"
            : confirming === "unpublish"
              ? "Unpublish"
              : "Publish"
        }
        description={
          confirming === "certify"
            ? "The tally is snapshotted, fingerprinted, published, and the election is locked permanently. No content can change afterwards - this cannot be undone."
            : confirming === "unpublish"
              ? "The public results page will stop showing results for this election until you publish again."
              : "The results become publicly visible immediately, regardless of the election's results policy."
        }
        isDestructive={confirming === "certify"}
        onConfirm={() => {
          if (confirming) void run(confirming);
        }}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        open={confirming !== null}
        requireExactMatch={confirming === "certify" ? "CERTIFY" : undefined}
        title={
          confirming === "certify"
            ? "Certify these results?"
            : confirming === "unpublish"
              ? "Unpublish the results?"
              : "Publish the results?"
        }
      />
    </div>
  );
}
