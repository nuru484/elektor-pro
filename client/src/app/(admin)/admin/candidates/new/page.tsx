"use client";

// Candidate nomination as a full page (the form outgrew a dialog): contest,
// identity, nickname, manifesto as text and/or PDF, and photo. Rides
// maker-checker - admins' submissions are staged for approval.
import { FileText, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PhotoInput } from "@/components/console/photo-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/states";
import { useCreateCandidateMutation, useGetElectionQuery, useListElectionsQuery } from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { type FormErrors, isValidEmail, validateRequired } from "@/utils/form-validate";

export default function NewCandidatePage() {
  const router = useRouter();
  const [electionId, setElectionId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [manifestoPdf, setManifestoPdf] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const { data: elections } = useListElectionsQuery({ limit: 100 });
  const { data: election } = useGetElectionQuery(electionId, { skip: !electionId });
  const [createCandidate, { isLoading: creating }] = useCreateCandidateMutation();

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const errs = validateRequired(f, {
      electionId: "Election",
      name: "Full name",
      portfolioId: "Portfolio",
    });
    const email = String(f.get("email") ?? "").trim();
    const phone = String(f.get("phone") ?? "").trim();
    if (!email && !phone) {
      errs.email = "Provide an email or phone number so the candidate can sign in";
    } else if (email && !isValidEmail(email)) {
      errs.email = "Enter a valid email address";
    }
    // The ballot shows faces: a candidate photo is compulsory.
    if (!photo) errs.photo = "A candidate photo is required";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const body = new FormData();
    body.append("electionId", String(f.get("electionId")));
    body.append("portfolioId", String(f.get("portfolioId")));
    body.append("name", String(f.get("name")));
    if (email) body.append("email", email);
    if (phone) body.append("phone", phone);
    if (f.get("nickname")) body.append("nickname", String(f.get("nickname")));
    if (f.get("manifesto")) body.append("manifesto", String(f.get("manifesto")));
    if (photo) body.append("image", photo);
    if (manifestoPdf) body.append("manifestoPdf", manifestoPdf);
    try {
      const res = await createCandidate(body).unwrap();
      toast.success(
        (res as { pending?: boolean }).pending ? "Submitted for approval" : "Candidate added",
      );
      router.push("/admin/candidates");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/admin/candidates"
        backLabel="Back to candidates"
        description="Nominate a candidate for a portfolio in one of your elections."
        title="Add candidate"
      />

      <form
        className="max-w-2xl space-y-5 sm:rounded-xl sm:border sm:border-border sm:bg-card sm:p-6"
        noValidate
        onSubmit={onCreate}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field error={errors.electionId} label="Election">
            <NativeSelect
              name="electionId"
              onChange={(e) => setElectionId(e.target.value)}
              required
              value={electionId}
            >
              <option value="">Select election…</option>
              {elections?.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field error={errors.portfolioId} label="Portfolio">
            <NativeSelect disabled={!electionId} name="portfolioId" required>
              <option value="">Select portfolio…</option>
              {election?.data.portfolios?.map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>
                  {portfolio.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field error={errors.name} label="Full name">
            <Input name="name" placeholder="e.g. Kwame Mensah" required />
          </Field>
          <Field
            hint="What supporters call this candidacy."
            label="Nickname / campaign name"
          >
            <Input name="nickname" placeholder='e.g. "Team Nuru" (optional)' />
          </Field>
        </div>
        {/* Contact is the candidate's sign-in identity: a candidate account
            with a temporary password is created (or linked) from it. */}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            error={errors.email}
            hint="At least one of email or phone is required - it becomes their sign-in and receives their temporary password."
            label="Email"
          >
            <Input
              name="email"
              placeholder="e.g. kwame@example.com"
              title="The candidate signs in with this email"
              type="email"
            />
          </Field>
          <Field hint="Used for sign-in and the SMS credentials message." label="Phone">
            <Input
              name="phone"
              placeholder="e.g. +233 24 000 0000"
              title="The candidate can sign in with this phone number"
              type="tel"
            />
          </Field>
        </div>
        <Field label="Manifesto (text)">
          <Textarea
            name="manifesto"
            placeholder="What the candidate stands for (optional)"
          />
        </Field>
        <Field
          hint="Optionally attach the full manifesto as a document."
          label="Manifesto (PDF)"
        >
          <div className="flex flex-wrap items-center gap-2">
            <input
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.type !== "application/pdf") {
                  toast.error("Manifesto must be a PDF file");
                  return;
                }
                setManifestoPdf(file);
              }}
              ref={pdfInputRef}
              type="file"
            />
            {manifestoPdf ? (
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm">
                <FileText className="size-4 shrink-0 text-brand" />
                <span className="min-w-0 truncate">{manifestoPdf.name}</span>
                <button
                  aria-label="Remove PDF"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setManifestoPdf(null);
                    if (pdfInputRef.current) pdfInputRef.current.value = "";
                  }}
                  type="button"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ) : (
              <Button
                onClick={() => pdfInputRef.current?.click()}
                size="sm"
                type="button"
                variant="outline"
              >
                Choose PDF
              </Button>
            )}
          </div>
        </Field>
        <div>
          <PhotoInput file={photo} label="Candidate photo (required)" onChange={setPhoto} />
          {errors.photo && (
            <p className="mt-1 text-xs text-destructive">{errors.photo}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => router.push("/admin/candidates")}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button loading={creating} type="submit" variant="brand">
            Add candidate
          </Button>
        </div>
      </form>
    </div>
  );
}
