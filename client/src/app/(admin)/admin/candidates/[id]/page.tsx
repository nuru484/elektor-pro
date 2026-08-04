"use client";

// Candidate profile. Identity rail left, editable candidacy right; ?edit=1
// opens the form straight from the table. The photo updates on its own;
// field edits ride maker-checker (202 = staged for approval).
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { Candidate } from "@/types/api";

import { AvatarUpdater } from "@/components/console/avatar-updater";
import {
  CARD_MOBILE,
  CARD_PAD_MOBILE,
} from "@/components/profile/details-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import {
  useGetCandidateQuery,
  useUpdateCandidateMutation,
  useUpdateCandidatePictureMutation,
} from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { formatDateTime } from "@/utils/format-date";

function CandidacyCard({
  candidate,
  editingInitially,
}: {
  candidate: Candidate;
  editingInitially: boolean;
}) {
  const [editing, setEditing] = useState(editingInitially);
  const [update, { isLoading: saving }] = useUpdateCandidateMutation();

  const onSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const res = await update({
        data: {
          manifesto: f.get("manifesto") || null,
          name: f.get("name"),
          party: f.get("party") || null,
        },
        id: candidate.id,
      }).unwrap();
      toast.success(
        (res as { pending?: boolean }).pending
          ? "Submitted for approval"
          : "Candidate updated",
      );
      setEditing(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Card className={CARD_MOBILE}>
      <CardHeader className={CARD_PAD_MOBILE}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Candidacy</CardTitle>
            <CardDescription>
              What voters see on the ballot and results.
            </CardDescription>
          </div>
          {!editing && (
            <Button onClick={() => setEditing(true)} size="sm" variant="outline">
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className={CARD_PAD_MOBILE}>
        {editing ? (
          <form className="max-w-lg space-y-4" onSubmit={onSave}>
            <Field label="Full name">
              <Input defaultValue={candidate.name} name="name" required />
            </Field>
            <Field label="Party / affiliation">
              <Input
                defaultValue={candidate.party ?? ""}
                name="party"
                placeholder="e.g. Progressive Alliance (optional)"
              />
            </Field>
            <Field label="Manifesto">
              <Textarea
                defaultValue={candidate.manifesto ?? ""}
                name="manifesto"
                placeholder="What the candidate stands for (optional)"
              />
            </Field>
            <div className="flex gap-2">
              <Button onClick={() => setEditing(false)} type="button" variant="ghost">
                Cancel
              </Button>
              <Button loading={saving} type="submit" variant="brand">
                Save changes
              </Button>
            </div>
          </form>
        ) : (
          <>
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
            </dl>
            {candidate.manifesto && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground">Manifesto</p>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">
                  {candidate.manifesto}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function CandidateProfilePage() {
  const params = useParams<{ id: string }>();
  const { data, isError, isLoading } = useGetCandidateQuery(params.id);
  const [updatePicture] = useUpdateCandidatePictureMutation();
  // Read once at mount: ?edit=1 (the tables' Edit action) opens the form.
  const [editInitially] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("edit") === "1",
  );
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
        <div className="gap-6 space-y-6 max-sm:space-y-8 lg:grid lg:grid-cols-[300px_1fr] lg:items-start lg:space-y-0">
          <Card className={`${CARD_MOBILE} lg:sticky lg:top-24`}>
            <CardContent
              className={`${CARD_PAD_MOBILE} flex flex-col items-center gap-3 py-6 text-center`}
            >
              <AvatarUpdater
                canEdit
                name={candidate.name}
                onUpload={(file) => updatePicture({ file, id: candidate.id }).unwrap()}
                url={candidate.profilePicture}
              />
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold">{candidate.name}</h1>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                  {candidate.portfolio && (
                    <Badge variant="brand">{candidate.portfolio.name}</Badge>
                  )}
                  {candidate.party && <Badge variant="outline">{candidate.party}</Badge>}
                </div>
              </div>
              <dl className="mt-2 w-full space-y-2.5 border-t border-border pt-4 text-left">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-muted-foreground">Added</dt>
                  <dd className="text-xs font-medium">
                    {formatDateTime(candidate.createdAt)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <CandidacyCard candidate={candidate} editingInitially={editInitially} />
        </div>
      )}
    </div>
  );
}
