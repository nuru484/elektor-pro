import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    answer:
      "No. Ballots are stored with no link to the voter who cast them. What we track separately is that each voter has voted - never what they chose. Even platform administrators cannot connect a ballot to a person.",
    question: "Can anyone see who I voted for?",
  },
  {
    answer:
      "After you vote, you get a private receipt code. Entering it on the verification page confirms your ballot is in the count and untampered - without revealing your choices to anyone, including you-standing-next-to-someone.",
    question: "How do I know my vote was actually counted?",
  },
  {
    answer:
      "Yes. Elections can require accreditation: an official checks each voter's ID at the venue and clears them to vote, and voters still authenticate themselves before their ballot opens. Remote, in-person, or both at once.",
    question: "Does it work for in-person voting days?",
  },
  {
    answer:
      "Voters receive a one-time code by SMS or email - there are no passwords for voters to forget on election day. A voter without a phone can still be verified in person by an accreditation official.",
    question: "What if a voter has no smartphone or forgets a password?",
  },
  {
    answer:
      "Everything stays. Voters, past elections, results, and audit history remain available season after season, so next year's committee starts from a running system instead of a blank spreadsheet.",
    question: "What happens after the election ends?",
  },
  {
    answer:
      "Sensitive changes made by administrators are staged and only take effect after a second, senior approval - and every action lands in a tamper-evident audit trail anyone authorized can inspect. No single person can quietly alter an election.",
    question: "What stops an administrator from rigging it?",
  },
];

export function Faq() {
  return (
    <section className="mx-auto w-full max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6" id="faq">
      <div className="text-center">
        <p className="text-sm font-medium text-brand">FAQ</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Questions committees ask us
        </h2>
      </div>
      <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
        {FAQS.map((faq) => (
          <details className="group px-6 py-4" key={faq.question}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
              {faq.question}
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
