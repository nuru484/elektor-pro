"use client";

import { ArrowRight, CheckCircle2, Vote } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { VoterChrome } from "@/components/vote/voter-header";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { setSessionMarker } from "@/lib/session-marker";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { type FormErrors } from "@/utils/form-validate";
import {
  useCodeLoginMutation,
  useListVoterElectionsQuery,
  useRequestOtpMutation,
  useVerifyOtpMutation,
} from "@/redux/voting-api";

function ElectionPicker() {
  const { data, isError, isLoading } = useListVoterElectionsQuery();
  if (isLoading) return <Skeleton className="h-28 w-full rounded-xl" />;
  if (isError) {
    return <EmptyState icon={Vote} title="Could not load your elections" />;
  }
  const elections = data?.data ?? [];
  if (elections.length === 0) {
    return <EmptyState icon={Vote} title="No open elections" description="There are no elections open for you to vote in right now." />;
  }
  return (
    <div className="space-y-3">
      {elections.map((e) => {
        const voted = e.voterElections[0]?.hasVoted;
        return (
          <Card key={e.id}>
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <p className="truncate font-medium">{e.name}</p>
                {e.description && (
                  <p className="truncate text-sm text-muted-foreground">{e.description}</p>
                )}
              </div>
              {voted ? (
                <Badge variant="success">
                  <CheckCircle2 className="size-3" /> Voted
                </Badge>
              ) : (
                <LinkButton href={`/vote/${e.id}`} size="sm" variant="brand">
                  Vote <ArrowRight className="size-3.5" />
                </LinkButton>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function VotePage() {
  const [requestOtp, { isLoading: requesting }] = useRequestOtpMutation();
  const [verifyOtp, { isLoading: verifying }] = useVerifyOtpMutation();
  const [codeLogin, { isLoading: codeSigning }] = useCodeLoginMutation();
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"code" | "done" | "identify" | "verify">(
    "identify",
  );
  const [errors, setErrors] = useState<FormErrors>({});

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

  if (stage === "done") {
    return (
      <VoterChrome>
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-semibold">Your elections</h1>
            <p className="text-sm text-muted-foreground">Choose an election to cast your ballot.</p>
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
