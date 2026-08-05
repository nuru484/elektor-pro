"use client";

// Public integrity page: anyone can re-verify the election's entire ballot
// chain (proving nothing was inserted, removed, or altered) and a voter can
// look up their own receipt to confirm their ballot was recorded as cast.
// Deliberately independent of results visibility: integrity is always public.
import {
  ArrowLeft,
  CheckCircle2,
  Link2,
  ShieldAlert,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";

import type { ReceiptVerification } from "@/types/api";

import { ReturnHomeLink } from "@/components/results/return-home-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useLazyVerifyReceiptQuery, useVerifyChainQuery } from "@/redux/voting-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { formatDateTime } from "@/utils/format-date";

const fmt = (n: number) => n.toLocaleString();

function ChainCard({ slug }: { slug: string }) {
  const { data, error, isError, isLoading } = useVerifyChainQuery(slug);
  const chain = data?.data;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-2.5">
          <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Ballot chain verification</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Every ballot is hash-linked to the one before it. This check
              re-derives the whole chain right now - if any ballot had been
              added, removed, or altered, the chain would break.
            </p>
            {isLoading ? (
              <Skeleton className="mt-3 h-12 rounded-lg" />
            ) : isError ? (
              <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {getApiErrorMessage(error, "Verification could not run")}
              </p>
            ) : chain?.valid ? (
              <p className="mt-3 flex items-center gap-2 rounded-lg border border-success/40 bg-success/5 px-3 py-2.5 text-sm font-medium text-success">
                <ShieldCheck className="size-4 shrink-0" />
                Chain intact: all {fmt(chain.total)}{" "}
                {chain.total === 1 ? "ballot" : "ballots"} verified
              </p>
            ) : chain ? (
              <p className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm font-medium text-destructive">
                <ShieldAlert className="size-4 shrink-0" />
                Chain BROKEN at ballot #{chain.brokenAt ?? 0} of {fmt(chain.total)} -
                contact the electoral commission
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReceiptCard({ slug }: { slug: string }) {
  const [code, setCode] = useState("");
  const [verify, { data, error, isError, isFetching }] = useLazyVerifyReceiptQuery();
  const receipt: null | ReceiptVerification = data?.data ?? null;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) return;
    void verify({ code: trimmed, electionId: slug });
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start gap-2.5">
          <Ticket className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Check your receipt</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Enter the receipt code you were shown after voting to confirm your
              ballot was recorded exactly as cast. Only someone holding the code
              can see this - ballots stay secret.
            </p>
            <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={onSubmit}>
              <Input
                aria-label="Receipt code"
                className="min-w-0 flex-1 font-mono"
                onChange={(e) => {
                  setCode(e.target.value);
                }}
                placeholder="e.g. AB12-CD34"
                title="The receipt code shown once after you cast your ballot"
                value={code}
              />
              <Button
                className="sm:shrink-0"
                loading={isFetching}
                title="Look this receipt up in the ballot record"
                type="submit"
                variant="brand"
              >
                Verify
              </Button>
            </form>

            {isError && (
              <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {getApiErrorMessage(error, "No ballot found for that receipt")}
              </p>
            )}
            {receipt && (
              <div className="mt-3 space-y-2 rounded-lg border border-success/40 bg-success/5 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                  <CheckCircle2 className="size-4 shrink-0" />
                  Ballot recorded {formatDateTime(receipt.castAt)}
                  {receipt.integrityValid ? "" : " (integrity check FAILED)"}
                </p>
                <ul className="space-y-1 border-t border-success/20 pt-2">
                  {receipt.choices.map((choice, index) => (
                    <li className="min-w-0 text-xs [overflow-wrap:anywhere]" key={index}>
                      <span className="text-muted-foreground">{choice.portfolio}: </span>
                      <span className="font-medium">
                        {choice.type === "ABSTAIN"
                          ? "Abstained"
                          : choice.type === "SKIP"
                            ? "Skipped"
                            : (choice.candidate ?? "Vote")}
                        {choice.approve === false ? " (No)" : ""}
                        {choice.approve === true ? " (Yes)" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            href={`/results/${slug}`}
          >
            <ArrowLeft className="size-4" /> Back to results
          </Link>
          <ReturnHomeLink />
        </div>
        <p className="mt-3 font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Election integrity
        </p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Verify this election</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These checks run against the real ballot record and are open to
          everyone - no sign-in needed.
        </p>
      </div>
      <ChainCard slug={slug} />
      <ReceiptCard slug={slug} />
    </div>
  );
}
