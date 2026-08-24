"use client";

// Demo entry point: one card per role, each signing in with a
// single click. No credentials are shown (or needed) - the server resolves
// the seeded account behind the role name, so nothing here is a password
// hint for the real login form.
import {
  ClipboardCheck,
  Eye,
  Loader2,
  Megaphone,
  ShieldCheck,
  UserRoundCheck,
  Vote,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/brand/logo";
import { homeForRole } from "@/components/console/nav-config";
import { setSessionMarker } from "@/lib/session-marker";
import { type DemoRole, useDemoLoginMutation } from "@/redux/auth-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

const DEMO_ROLES: {
  blurb: string;
  icon: typeof ShieldCheck;
  label: string;
  role: DemoRole;
}[] = [
  {
    blurb:
      "The full console: every election, the audit trail, approvals, staff and role permissions.",
    icon: ShieldCheck,
    label: "Super admin",
    role: "SUPER_ADMIN",
  },
  {
    blurb:
      "Run elections day to day - positions, candidates, voter register, and results.",
    icon: ClipboardCheck,
    label: "Administrator",
    role: "ADMIN",
  },
  {
    blurb:
      "The accreditation desk: check voters in at a polling station and issue voting codes.",
    icon: UserRoundCheck,
    label: "Accreditor",
    role: "ACCREDITOR",
  },
  {
    blurb:
      "A candidate's agent watching live turnout and results for the race they observe.",
    icon: Eye,
    label: "Candidate agent",
    role: "AGENT",
  },
  {
    blurb:
      "A candidate's own view: nomination status, vetting scores, and where they stand.",
    icon: Megaphone,
    label: "Candidate",
    role: "CANDIDATE",
  },
  {
    blurb:
      "The voter portal: the ballot you are eligible for, your receipt, and past votes.",
    icon: Vote,
    label: "Voter",
    role: "VOTER",
  },
];

export default function DemoPage() {
  const router = useRouter();
  const [demoLogin] = useDemoLoginMutation();
  // Which card is signing in - so only that button shows a spinner.
  const [pending, setPending] = useState<DemoRole | null>(null);

  const signIn = async (role: DemoRole) => {
    setPending(role);
    try {
      const res = await demoLogin({ role }).unwrap();
      // The console gate and the voter portal both read this marker: without
      // it a signed-in demo voter still lands on the sign-in form.
      setSessionMarker();
      toast.success(res.message);
      router.push(homeForRole(res.data.role));
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Demo sign-in is unavailable right now."),
      );
      setPending(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-svh max-w-4xl flex-col justify-center px-6 py-16">
      <Logo className="mb-8" imgSize={36} textClassName="text-xl" />

      <h1 className="text-2xl font-medium sm:text-3xl md:text-4xl">Try Elektor Pro</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
        This is a portfolio demonstration running on sample data. Pick a role
        to sign in instantly - no account, no password. Everything you see is
        seeded; feel free to click around and change things. Come back here
        any time to switch to a different role.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {DEMO_ROLES.map(({ blurb, icon: Icon, label, role }) => (
          <button
            className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card/60 p-5 text-left transition-colors hover:border-brand/50 disabled:opacity-60"
            disabled={pending !== null}
            key={role}
            onClick={() => void signIn(role)}
            type="button"
          >
            <span className="flex items-center gap-2.5">
              {pending === role ? (
                <Loader2 aria-hidden className="size-5 animate-spin text-brand" />
              ) : (
                <Icon aria-hidden className="size-5 text-brand" />
              )}
              <span className="font-medium">
                {pending === role ? `Signing in as ${label}...` : label}
              </span>
            </span>
            <span className="text-sm leading-relaxed text-muted-foreground">
              {blurb}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Have real credentials?{" "}
        <Link className="font-medium text-brand hover:underline" href="/login">
          Sign in to your account
        </Link>{" "}
        or{" "}
        <Link className="font-medium text-brand hover:underline" href="/">
          go back to the homepage
        </Link>
        .
      </p>
    </main>
  );
}
