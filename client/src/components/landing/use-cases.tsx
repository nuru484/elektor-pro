import { Building2, GraduationCap, HandshakeIcon, Landmark } from "lucide-react";

const USE_CASES = [
  {
    body: "SRC and departmental elections, hall week polls, class rep votes - run them all every year on one platform, with the full history kept.",
    icon: GraduationCap,
    title: "Universities & schools",
  },
  {
    body: "National, regional, and branch executive elections with constituency-scoped ballots and agents observing the count for every candidate.",
    icon: Landmark,
    title: "Unions & federations",
  },
  {
    body: "Annual general meetings, board seats, and constitutional referenda - with quorum-ready turnout numbers and certified outcomes.",
    icon: HandshakeIcon,
    title: "Associations & clubs",
  },
  {
    body: "Staff councils, committee seats, and workplace polls that need anonymity guarantees employees actually believe.",
    icon: Building2,
    title: "Companies & co-ops",
  },
];

export function UseCases() {
  return (
    <section className="border-y border-border bg-card/50">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-brand">Who it&apos;s for</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            One platform, every kind of organization
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Set it up once and reuse it election after election, year after
            year - your members keep one login and the full history stays at
            their fingertips.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {USE_CASES.map((useCase) => (
            <div
              className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-brand/40"
              key={useCase.title}
            >
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-brand-muted text-brand">
                <useCase.icon className="size-4" />
              </span>
              <h3 className="mt-4 font-medium">{useCase.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{useCase.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
