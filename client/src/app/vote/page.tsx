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
  Copy,
  ShieldCheck,
  ShieldX,
  Vote,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import {
  ElectionFilterBar,
  EMPTY_ELECTION_FILTER,
  type ElectionFilter,
} from "@/components/console/election-filter-bar";
import { ListPagination } from "@/components/console/list-pagination";
import { useDebounce } from "@/hooks/use-debounce";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoterChrome } from "@/components/vote/voter-header";
import { hasSessionMarker, setSessionMarker } from "@/lib/session-marker";
import { useGetMeQuery } from "@/redux/auth-api";
import {
  useCodeLoginMutation,
  useGetVoterHistoryQuery,
  useListVoterElectionsQuery,
  useRequestOtpMutation,
  useVerifyOtpMutation,
  type VoterElectionItem,
  type VoterHistoryItem,
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

function HistoryCard({ item }: { item: VoterHistoryItem }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="min-w-0">
          <p className="min-w-0 font-medium [overflow-wrap:anywhere]">
            {item.election.name}
          </p>
          {item.votedAt && (
            <p className="text-xs text-muted-foreground">
              You voted on {formatDate(item.votedAt)}
            </p>
          )}
        </div>

        {/*
          Choices appear only for an open ballot, which is the election type
          that deliberately stores the link. A secret ballot has nothing to
          replay - by design, not by omission - so it says so instead.
        */}
        {item.choices && item.choices.length > 0 ? (
          <ul className="space-y-1 rounded-lg border border-border bg-muted/30 p-3">
            {item.choices.map((choice, index) => (
              <li className="min-w-0 text-xs [overflow-wrap:anywhere]" key={index}>
                <span className="text-muted-foreground">
                  {choice.portfolio.name}:{" "}
                </span>
                <span className="font-medium">
                  {choice.type === "ABSTAIN"
                    ? "Abstained"
                    : choice.type === "SKIP"
                      ? "Skipped"
                      : (choice.candidate?.name ?? "Vote")}
                  {choice.approve === true ? " (Yes)" : ""}
                  {choice.approve === false ? " (No)" : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            This ballot was secret, so your choices are not stored against your
            name. Use the receipt code you saved when you voted to confirm it
            was counted, exactly as cast.
          </p>
        )}

        {item.receiptCode && (
          <button
            className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 font-mono text-xs"
            onClick={() => {
              void navigator.clipboard.writeText(item.receiptCode ?? "");
              toast.success("Receipt copied");
            }}
            title="Your ballot receipt code - click to copy"
            type="button"
          >
            {item.receiptCode} <Copy className="size-3 text-muted-foreground" />
          </button>
        )}

        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
            href={`/results/${item.election.slug}/verify`}
            title="Verify your ballot was recorded exactly as cast"
          >
            <ShieldCheck className="size-3.5" /> Verify my ballot
          </Link>
          <Link
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            href={`/results/${item.election.slug}`}
            title="This election's results page"
          >
            <BarChart3 className="size-3.5" /> Results
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function VotingHistory({ filter }: { filter: ElectionFilter }) {
  const { params, setPage } = usePersonalListParams(filter);
  const { data, isLoading } = useGetVoterHistoryQuery(params);
  const history = data?.data ?? [];
  if (isLoading) return <Skeleton className="h-28 w-full rounded-xl" />;
  if (history.length === 0) {
    return (
      <EmptyState
        description={
          filter.search || filter.from || filter.to
            ? "No vote matches your search or period. Clear the filters to see everything."
            : "Once you cast a ballot, the election appears here with the date you voted."
        }
        icon={CheckCircle2}
        title={
          filter.search || filter.from || filter.to
            ? "No matches"
            : "You have not voted yet"
        }
      />
    );
  }
  return (
    <div className="space-y-3">
      {history.map((item) => (
        <HistoryCard item={item} key={item.election.id} />
      ))}
      <ListPagination meta={data?.meta} onPageChange={setPage} />
    </div>
  );
}

/** Filter + page state → query params. Search is debounced. */
const usePersonalListParams = (filter: ElectionFilter) => {
  const [page, setPage] = useState(1);
  const search = useDebounce(filter.search.trim(), 400);
  // Any filter change starts back at page 1.
  const key = `${search}|${filter.from}|${filter.to}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setPage(1);
  }
  return {
    params: {
      from: filter.from || undefined,
      limit: 10,
      page,
      search: search || undefined,
      to: filter.to || undefined,
    },
    setPage,
  };
};

function ElectionPicker({ filter }: { filter: ElectionFilter }) {
  const { params, setPage } = usePersonalListParams(filter);
  const { data, isError, isLoading } = useListVoterElectionsQuery(params);
  if (isLoading) return <Skeleton className="h-28 w-full rounded-xl" />;
  if (isError) {
    return <EmptyState icon={Vote} title="Could not load your elections" />;
  }
  const elections = data?.data ?? [];
  if (elections.length === 0) {
    return (
      <EmptyState
        description={
          filter.search || filter.from || filter.to
            ? "No election matches your search or period. Clear the filters to see everything."
            : "There are no open or upcoming elections for you right now. When one is scheduled, it appears here."
        }
        icon={Vote}
        title={filter.search || filter.from || filter.to ? "No matches" : "No elections yet"}
      />
    );
  }
  return (
    <div className="space-y-3">
      {elections.map((election) => (
        <ElectionCard election={election} key={election.id} />
      ))}
      <ListPagination meta={data?.meta} onPageChange={setPage} />
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
  const [filter, setFilter] = useState<ElectionFilter>(EMPTY_ELECTION_FILTER);

  // A returning voter with a live session skips the sign-in forms entirely -
  // the login page is unreachable until they log out.
  const marker = hasSessionMarker();
  const { data: meData, isLoading: meLoading } = useGetMeQuery(undefined, {
    skip: !marker,
  });
  const sessionVoter = meData?.data.role === "VOTER" ? meData.data : null;
  const signedIn = stage === "done" || sessionVoter !== null;

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
      <VoterChrome>
        <div className="space-y-5">
          <div>
            <h1 className="text-xl font-semibold">Your elections</h1>
            <p className="text-sm text-muted-foreground">
              Everything you can vote in - and everything you already voted.
            </p>
          </div>
          <Tabs className="gap-4" defaultValue="elections">
            <TabsList>
              <TabsTrigger value="elections">Elections</TabsTrigger>
              <TabsTrigger value="votes">My votes</TabsTrigger>
            </TabsList>
            <ElectionFilterBar filter={filter} onChange={setFilter} />
            <TabsContent value="elections">
              <ElectionPicker filter={filter} />
            </TabsContent>
            <TabsContent value="votes">
              <VotingHistory filter={filter} />
            </TabsContent>
          </Tabs>
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
