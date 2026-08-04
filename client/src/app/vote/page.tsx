"use client";

// The voter portal. Signed-in voters land straight on their elections (the
// sign-in forms are unreachable until they log out, like the staff login);
// signing in works via SMS/email OTP or the one-time accreditation code.
// Each election card shows the voter's full standing: window, status,
// accreditation, whether they voted, and the path to results.
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ShieldX,
  Vote,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { VoterChrome } from "@/components/vote/voter-header";
import {
  clearSessionMarker,
  hasSessionMarker,
  setSessionMarker,
} from "@/lib/session-marker";
import { useGetMeQuery, useLogoutMutation } from "@/redux/auth-api";
import {
  useCodeLoginMutation,
  useListVoterElectionsQuery,
  useRequestOtpMutation,
  useVerifyOtpMutation,
  type VoterElectionItem,
} from "@/redux/voting-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { formatDate } from "@/utils/format-date";
import { type FormErrors } from "@/utils/form-validate";

function ElectionCard({ election }: { election: VoterElectionItem }) {
  const entry = election.voterElections.at(0);
  const voted = entry?.hasVoted ?? false;
  const accredited = Boolean(entry?.accreditedAt);
  const excluded = entry ? !entry.isEligible : false;
  const open = election.status === "IN_PROGRESS";
  const needsDesk = election.accreditationRequired && !accredited;
  const canVote = open && !voted && !excluded && !needsDesk;
  const resultsOpen =
    election.resultsPublishedAt !== null || election.resultsPolicy === "LIVE";

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 font-medium [overflow-wrap:anywhere]">
            {election.name}
          </p>
          {open ? (
            <Badge title="Voting is open right now" variant="success">
              Open
            </Badge>
          ) : (
            <Badge title="Voting has not started yet" variant="secondary">
              Upcoming
            </Badge>
          )}
        </div>
        {election.description && (
          <p className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {election.description}
          </p>
        )}
        <p
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          title="The voting window"
        >
          <CalendarClock className="size-3.5 shrink-0" />
          {formatDate(election.startDate)} to {formatDate(election.endDate)}
        </p>

        {/* Standing: every fact the voter needs, in plain words. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {voted && (
            <span
              className="inline-flex items-center gap-1 font-medium text-success"
              title="Your ballot is recorded"
            >
              <CheckCircle2 className="size-3.5" /> You have voted
            </span>
          )}
          {excluded && (
            <span
              className="inline-flex items-center gap-1 text-destructive"
              title="An administrator excluded you from this election"
            >
              <ShieldX className="size-3.5" /> Not eligible
            </span>
          )}
          {!voted && !excluded && election.accreditationRequired && (
            <span
              className={
                accredited
                  ? "inline-flex items-center gap-1 text-success"
                  : "inline-flex items-center gap-1 text-muted-foreground"
              }
              title={
                accredited
                  ? "You have been checked in at the accreditation desk"
                  : "Visit the accreditation desk to be checked in before voting"
              }
            >
              <BadgeCheck className="size-3.5" />
              {accredited ? "Accredited" : "Accreditation required"}
            </span>
          )}
        </div>

        {/* Actions on their own row; never squeezing the text above. */}
        <div className="flex flex-wrap gap-2 pt-1">
          {canVote && (
            <LinkButton
              href={`/vote/${election.id}`}
              size="sm"
              title="Open your ballot"
              variant="brand"
            >
              Vote now <ArrowRight className="size-3.5" />
            </LinkButton>
          )}
          {!open && !voted && (
            <span className="inline-flex h-8 items-center text-xs text-muted-foreground">
              Voting opens {formatDate(election.startDate)}
            </span>
          )}
          {(voted || resultsOpen) && (
            <LinkButton
              href={`/results/${election.slug}`}
              size="sm"
              title="See this election's results page"
              variant="outline"
            >
              <BarChart3 className="size-3.5" /> Results
            </LinkButton>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ElectionPicker() {
  const { data, isError, isLoading } = useListVoterElectionsQuery();
  if (isLoading) return <Skeleton className="h-28 w-full rounded-xl" />;
  if (isError) {
    return <EmptyState icon={Vote} title="Could not load your elections" />;
  }
  const elections = data?.data ?? [];
  if (elections.length === 0) {
    return (
      <EmptyState
        description="There are no open or upcoming elections for you right now. When one is scheduled, it appears here."
        icon={Vote}
        title="No elections yet"
      />
    );
  }
  return (
    <div className="space-y-3">
      {elections.map((election) => (
        <ElectionCard election={election} key={election.id} />
      ))}
    </div>
  );
}

export default function VotePage() {
  const [requestOtp, { isLoading: requesting }] = useRequestOtpMutation();
  const [verifyOtp, { isLoading: verifying }] = useVerifyOtpMutation();
  const [codeLogin, { isLoading: codeSigning }] = useCodeLoginMutation();
  const [logout] = useLogoutMutation();
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"code" | "done" | "identify" | "verify">(
    "identify",
  );
  const [errors, setErrors] = useState<FormErrors>({});

  // A returning voter with a live session skips the sign-in forms entirely -
  // the login page is unreachable until they log out.
  const marker = hasSessionMarker();
  const { data: meData, isLoading: meLoading } = useGetMeQuery(undefined, {
    skip: !marker,
  });
  const sessionVoter = meData?.data.role === "VOTER" ? meData.data : null;
  const signedIn = stage === "done" || sessionVoter !== null;

  const onLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // Even a failed API logout clears this browser's state below.
    }
    clearSessionMarker();
    // Full reload drops every cached query and returns to the sign-in form.
    window.location.assign("/vote");
  };

  // Polling-station path: the one-time code handed over at accreditation.
  const onCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: FormErrors = {};
    if (!identifier.trim()) errs.identifier = "Voter ID is required";
    if (!code.trim()) errs.code = "Enter the code from the accreditation desk";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      await codeLogin({ code: code.trim(), voterId: identifier.trim() }).unwrap();
      setSessionMarker();
      setStage("done");
      toast.success("You're verified");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Invalid voter ID or code"));
    }
  };

  const onRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrors({ identifier: "Voter ID is required" });
      return;
    }
    setErrors({});
    try {
      const res = await requestOtp({ identifier }).unwrap();
      setStage("verify");
      toast.success(
        `Code ${res.data.channel === "email" ? "emailed" : "sent"} to ${res.data.destinationMasked}`,
      );
      if (res.data.devCode) toast.info(`Dev code: ${res.data.devCode}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not send code"));
    }
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrors({ code: "Enter the code we sent you" });
      return;
    }
    setErrors({});
    try {
      await verifyOtp({ code, identifier }).unwrap();
      // Voters can visit proxy-gated pages like /profile, so mark the
      // frontend domain as holding a session here too.
      setSessionMarker();
      setStage("done");
      toast.success("You're verified");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Invalid code"));
    }
  };

  if (marker && meLoading && stage !== "done") {
    return (
      <VoterChrome>
        <Skeleton className="h-40 w-full rounded-xl" />
      </VoterChrome>
    );
  }

  if (signedIn) {
    return (
      <VoterChrome
        onLogout={() => void onLogout()}
        signedInName={
          sessionVoter
            ? `${sessionVoter.firstName} ${sessionVoter.lastName}`
            : undefined
        }
      >
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-semibold">Your elections</h1>
            <p className="text-sm text-muted-foreground">
              Everything you can vote in - open now or coming up.
            </p>
          </div>
          <ElectionPicker />
        </div>
      </VoterChrome>
    );
  }

  return (
    <AuthShell
      subtitle={
        stage === "identify"
          ? "Enter your voter ID. We'll send a one-time code to the phone or email on record."
          : stage === "code"
            ? "Enter your voter ID and the one-time code you received at the accreditation desk."
            : "We sent a one-time code. Enter it below."
      }
      title={
        stage === "identify"
          ? "Verify your identity"
          : stage === "code"
            ? "Sign in with a voting code"
            : "Enter your code"
      }
    >
      <>
        {stage === "identify" ? (
          <form className="space-y-5" noValidate onSubmit={onRequest}>
            <Field error={errors.identifier} label="Voter ID">
              <Input
                autoFocus
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. STU1001"
                value={identifier}
              />
            </Field>
            <Button className="w-full" loading={requesting} type="submit">
              Send code
            </Button>
            <button
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setStage("code")}
              type="button"
            >
              Got a voting code from the accreditation desk? Sign in with it
            </button>
          </form>
        ) : stage === "code" ? (
          <form className="space-y-5" noValidate onSubmit={onCodeLogin}>
            <Field error={errors.identifier} label="Voter ID">
              <Input
                autoFocus
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. STU1001"
                value={identifier}
              />
            </Field>
            <Field error={errors.code} label="Voting code">
              <Input
                className="font-mono tracking-widest uppercase"
                onChange={(e) => setCode(e.target.value)}
                placeholder="XXXX-XXXX"
                value={code}
              />
            </Field>
            <Button className="w-full" loading={codeSigning} type="submit">
              Sign in
            </Button>
            <button
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setStage("identify")}
              type="button"
            >
              Use an SMS or email code instead
            </button>
          </form>
        ) : (
          <form className="space-y-5" noValidate onSubmit={onVerify}>
            <Field error={errors.code} label="One-time code">
              <Input
                autoFocus
                inputMode="numeric"
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                value={code}
              />
            </Field>
            <Button className="w-full" loading={verifying} type="submit">
              Verify
            </Button>
            <button
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setStage("identify")}
              type="button"
            >
              Use a different voter ID
            </button>
          </form>
        )}
      </>
    </AuthShell>
  );
}
