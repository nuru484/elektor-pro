"use client";

// Candidate profile: who they are, what they're contesting, and their
// manifesto.
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  CARD_MOBILE,
  CARD_PAD_MOBILE,
} from "@/components/profile/details-section";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useGetCandidateQuery } from "@/redux/admin-api";

export default function CandidateProfilePage() {
  const params = useParams<{ id: string }>();
  const { data, isError, isLoading } = useGetCandidateQuery(params.id);
  const candidate = data?.data;

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        href="/admin/candidates"
      >
        <ArrowLeft className="size-4" /> Back to candidates
      </Link>

      {isLoading ? (
        <CardGridSkeleton count={2} />
      ) : isError || !candidate ? (
        <ErrorState />
      ) : (
        <div className="space-y-6 max-sm:space-y-8">
          <Card className={CARD_MOBILE}>
            <CardContent className={`${CARD_PAD_MOBILE} flex items-center gap-4 py-6`}>
              <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-brand text-lg font-semibold text-brand-foreground">
                {candidate.profilePicture ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Cloudinary avatar
                  <img
                    alt=""
                    className="size-full object-cover"
                    src={candidate.profilePicture}
                  />
                ) : (
                  candidate.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold">{candidate.name}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {candidate.portfolio && (
                    <Badge variant="brand">{candidate.portfolio.name}</Badge>
                  )}
                  {candidate.party && <Badge variant="outline">{candidate.party}</Badge>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={CARD_MOBILE}>
            <CardHeader className={CARD_PAD_MOBILE}>
              <CardTitle className="text-base">Candidacy</CardTitle>
            </CardHeader>
            <CardContent className={CARD_PAD_MOBILE}>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Election</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {candidate.election?.name ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Portfolio</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {candidate.portfolio?.name ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Party / affiliation</dt>
                  <dd className="mt-0.5 text-sm font-medium">{candidate.party ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Added</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {candidate.createdAt
                      ? new Date(candidate.createdAt).toLocaleDateString()
                      : "—"}
                  </dd>
                </div>
              </dl>
              {candidate.manifesto && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Manifesto</p>
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">
                    {candidate.manifesto}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
