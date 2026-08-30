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

import Link from "next/link";

import type { Candidate } from "@/types/api";

import { VettingPanel } from "@/components/candidates/vetting-panel";
import { AvatarUpdater } from "@/components/console/avatar-updater";
import { ProfileSkeleton } from "@/components/console/profile-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
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
    const email = String(f.get("email") ?? "").trim();
    const phone = String(f.get("phone") ?? "").trim();
    try {
      const res = await update({
        data: {
          manifesto: f.get("manifesto") || null,
          name: f.get("name"),
          nickname: f.get("nickname") || null,
          // Contact on an account-less candidate creates their sign-in
          // account server-side.
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
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
            {!candidate.account && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  hint="Adding a contact creates their sign-in account with a temporary password."
                  label="Email"
                >
                  <Input name="email" placeholder="e.g. kwame@example.com" type="email" />
                </Field>
                <Field label="Phone">
                  <Input name="phone" placeholder="e.g. +233 24 000 0000" type="tel" />
                </Field>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => setEditing(false)} type="button" variant="outline">
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
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Election</dt>
                <dd className="mt-0.5 min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
                  {candidate.election ? (
                    <Link
                      className="hover:text-brand"
                      href={`/admin/elections/${candidate.election.id}`}
                      title="Open this election's workspace"
                    >
                      {candidate.election.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Portfolio</dt>
                <dd className="mt-0.5 min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
                  {candidate.portfolio?.name ?? "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Nickname / campaign name</dt>
                <dd className="mt-0.5 min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
                  {candidate.nickname ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Ballot number</dt>
                <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums">
                  {candidate.ballotNumber ?? "Not assigned"}
                </dd>
              </div>
              <div className="min-w-0" title="The candidate signs in with this email">
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="mt-0.5 min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
                  {candidate.account?.email ?? "Not set"}
                </dd>
              </div>
              <div className="min-w-0" title="The candidate can sign in with this phone number">
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd className="mt-0.5 min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
                  {candidate.account?.phone ?? "Not set"}
                </dd>
              </div>
              {!candidate.account && (
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Login account</dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground">
                    None yet - edit the candidate and add an email or phone to
                    create one.
                  </dd>
                </div>
              )}
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
      <PageHeader
        backHref="/admin/candidates"
        backLabel="Back to candidates"
        description="View and manage this candidacy."
        title="Candidate profile"
      />

      {/* The ballot shows faces: keep nudging until the photo exists. */}
      {candidate && !candidate.profilePicture && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
          This candidate has no photo yet. Voters see faces on the ballot -
          click the avatar below to upload one.
        </p>
      )}

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
              <div className="min-w-0 w-full">
                <h1 className="min-w-0 text-xl font-semibold [overflow-wrap:anywhere]">
                  {candidate.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                  {candidate.status && <StatusBadge status={candidate.status} />}
                  {candidate.ballotNumber != null && (
                    <Badge variant="outline">No. {candidate.ballotNumber}</Badge>
                  )}
                </div>
                {/* Portfolio + nickname are admin-authored free text: plain
                    wrapping lines, never badges. */}
                {candidate.portfolio && (
                  <p className="mt-2 min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {candidate.portfolio.name}
                  </p>
                )}
                {candidate.nickname && (
                  <p className="mt-0.5 min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    “{candidate.nickname}”
                  </p>
                )}
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

          <div className="min-w-0 space-y-6 max-sm:space-y-8">
            <CandidacyCard candidate={candidate} editingInitially={editInitially} />
            <VettingPanel candidate={candidate} />
            {candidate.otherCandidacies && candidate.otherCandidacies.length > 0 && (
              <Card className={CARD_MOBILE}>
                <CardHeader className={CARD_PAD_MOBILE}>
                  <CardTitle className="text-base">Other candidacies</CardTitle>
                  <CardDescription>
                    Elections this person has contested through the same account.
                  </CardDescription>
                </CardHeader>
                <CardContent className={CARD_PAD_MOBILE}>
                  {/* Many elections stay tidy: the list scrolls, never crowds. */}
                  <ul className="max-h-64 divide-y divide-border overflow-y-auto">
                    {candidate.otherCandidacies.map((candidacy) => (
                      <li className="py-2.5 first:pt-0 last:pb-0" key={candidacy.id}>
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            className="min-w-0 truncate text-sm font-medium hover:text-brand"
                            href={`/admin/candidates/${candidacy.id}`}
                          >
                            {candidacy.election.name}
                          </Link>
                          <StatusBadge status={candidacy.status} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {candidacy.portfolio.name}
                        </p>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
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
