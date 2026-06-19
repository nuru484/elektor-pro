"use client";

import { ArrowRight, CheckCircle2, Smartphone, Vote } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { getApiErrorMessage } from "@/lib/api-error";
import {
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
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"done" | "identify" | "verify">("identify");

  const onRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await requestOtp({ identifier }).unwrap();
      setStage("verify");
      toast.success(`Code sent to ${res.data.phoneMasked}`);
      if (res.data.devCode) toast.info(`Dev code: ${res.data.devCode}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not send code"));
    }
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await verifyOtp({ code, identifier }).unwrap();
      setStage("done");
      toast.success("You're verified");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Invalid code"));
    }
  };

  if (stage === "done") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Your elections</h1>
          <p className="text-sm text-muted-foreground">Choose an election to cast your ballot.</p>
        </div>
        <ElectionPicker />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <span className="mb-1 flex size-9 items-center justify-center rounded-lg bg-brand-muted text-brand">
          <Smartphone className="size-5" />
        </span>
        <CardTitle className="text-lg">
          {stage === "identify" ? "Verify your identity" : "Enter your code"}
        </CardTitle>
        <CardDescription>
          {stage === "identify"
            ? "Enter your voter ID. We'll text a one-time code to the phone on record."
            : "We sent a one-time code to your phone. Enter it below."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stage === "identify" ? (
          <form className="space-y-4" onSubmit={onRequest}>
            <Field label="Voter ID">
              <Input
                autoFocus
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. STU1001"
                value={identifier}
              />
            </Field>
            <Button className="w-full" loading={requesting} type="submit" variant="brand">
              Send code
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={onVerify}>
            <Field label="One-time code">
              <Input
                autoFocus
                inputMode="numeric"
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                value={code}
              />
            </Field>
            <Button className="w-full" loading={verifying} type="submit" variant="brand">
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
      </CardContent>
    </Card>
  );
}
