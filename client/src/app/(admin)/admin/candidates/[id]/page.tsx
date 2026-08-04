"use client";

// Candidate profile. Identity rail left, editable candidacy right; ?edit=1
// opens the form straight from the table. The photo updates on its own;
// field edits ride maker-checker (202 = staged for approval).
import { FileText, Pencil, Upload } from "lucide-react";
import { useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast as sonnerToast } from "sonner";
import { toast } from "sonner";

import type { Candidate } from "@/types/api";

import { AvatarUpdater } from "@/components/console/avatar-updater";
import { ProfileSkeleton } from "@/components/console/profile-skeleton";
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
import { ErrorState, PageHeader } from "@/components/ui/states";
import {
  useGetCandidateQuery,
  useUpdateCandidateManifestoMutation,
  useUpdateCandidateMutation,
  useUpdateCandidatePictureMutation,
} from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { type FormErrors, validateRequired } from "@/utils/form-validate";
import { formatDateTime } from "@/utils/format-date";

function CandidacyCard({
  candidate,
  editingInitially,
}: {
  candidate: Candidate;
  editingInitially: boolean;
}) {
  const [editing, setEditing] = useState(editingInitially);
  const [errors, setErrors] = useState<FormErrors>({});
  const [update, { isLoading: saving }] = useUpdateCandidateMutation();

  const onSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const errs = validateRequired(f, { name: "Full name" });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      const res = await update({
        data: {
          manifesto: f.get("manifesto") || null,
          name: f.get("name"),
          nickname: f.get("nickname") || null,
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
          <form className="max-w-lg space-y-4" noValidate onSubmit={onSave}>
            <Field error={errors.name} label="Full name">
              <Input defaultValue={candidate.name} name="name" required />
            </Field>
            <Field label="Nickname / campaign name">
              <Input
                defaultValue={candidate.nickname ?? ""}
                name="nickname"
                placeholder='e.g. "Team Nuru" (optional)'
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
                <dt className="text-xs text-muted-foreground">Nickname / campaign name</dt>
                <dd className="mt-0.5 text-sm font-medium">{candidate.nickname ?? "—"}</dd>
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
            <ManifestoPdf candidate={candidate} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** The manifesto as a document: view the current PDF, replace it anytime. */
function ManifestoPdf({ candidate }: { candidate: Candidate }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, { isLoading }] = useUpdateCandidateManifestoMutation();

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      sonnerToast.error("Manifesto must be a PDF file");
      return;
    }
    try {
      await upload({ file, id: candidate.id }).unwrap();
      sonnerToast.success("Manifesto PDF updated");
    } catch (error) {
      sonnerToast.error(getApiErrorMessage(error));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
      {candidate.manifestoUrl ? (
        <a
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          href={candidate.manifestoUrl}
          rel="noreferrer"
          target="_blank"
        >
          <FileText className="size-4" /> View manifesto (PDF)
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">No manifesto document uploaded.</p>
      )}
      <input
        accept="application/pdf"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
        ref={inputRef}
        type="file"
      />
      <Button
        className="ml-auto"
        loading={isLoading}
        onClick={() => inputRef.current?.click()}
        size="sm"
        type="button"
        variant="outline"
      >
        <Upload className="size-3.5" />
        {candidate.manifestoUrl ? "Replace PDF" : "Upload PDF"}
      </Button>
    </div>
  );
}

function CandidateProfileContent() {
  const params = useParams<{ id: string }>();
  const { data, isError, isLoading } = useGetCandidateQuery(params.id);
  const [updatePicture] = useUpdateCandidatePictureMutation();
  const searchParams = useSearchParams();
  const editInitially = searchParams.get("edit") === "1";
  const candidate = data?.data;


  return (
    <div className="space-y-6">
      <PageHeader description="View and manage this candidacy." title="Candidate profile" />

      {isLoading ? (
        <ProfileSkeleton />
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
                  {candidate.nickname && <Badge variant="outline">{candidate.nickname}</Badge>}
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

export default function CandidateProfilePage() {
  // useSearchParams needs a Suspense boundary for prerendering.
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <CandidateProfileContent />
    </Suspense>
  );
}
