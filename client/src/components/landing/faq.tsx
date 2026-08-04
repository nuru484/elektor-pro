// Minimal bordered-row FAQ (native details/summary, plus/minus marker).
const FAQS = [
  {
    answer:
      "No. Ballots are stored with no link to the voter who cast them. What we track separately is that each voter has voted - never what they chose. Even platform administrators cannot connect a ballot to a person.",
    question: "Can anyone see who I voted for?",
  },
  {
    answer:
      "After you vote, you get a private receipt code. Entering it on the verification page confirms your ballot is in the count and untampered, without revealing your choices to anyone.",
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
    question: "What if a voter has no smartphone?",
  },
  {
    answer:
      "Everything stays. Voters, past elections, results, and audit history remain available season after season, so next year's committee starts from a running system instead of a blank spreadsheet.",
    question: "What happens after the election ends?",
  },
  {
    answer:
      "Sensitive changes made by administrators are staged and only take effect after a second, senior approval - and every action lands in a tamper-evident audit trail. No single person can quietly alter an election.",
    question: "What stops an administrator from rigging it?",
  },
];

export function Faq() {
  return (
    <section
      className="mx-auto mb-24 flex max-w-6xl scroll-mt-8 flex-col gap-8 px-6 md:mb-32 md:px-12"
      id="faq"
    >
      <h2 className="text-4xl font-medium md:text-5xl">Questions, answered</h2>
      <div>
        {FAQS.map((faq) => (
          <details className="group border-t border-border last:border-b" key={faq.question}>
            <summary className="flex list-none items-baseline justify-between gap-6 py-6 text-xl font-medium md:text-2xl [&::-webkit-details-marker]:hidden">
              {faq.question}
              <span
                aria-hidden
                className="shrink-0 text-2xl font-light text-muted-foreground group-open:hidden"
              >
                +
              </span>
              <span
                aria-hidden
                className="hidden shrink-0 text-2xl font-light text-muted-foreground group-open:inline"
              >
                −
              </span>
            </summary>
            <p className="max-w-2xl pb-6 text-lg leading-relaxed text-muted-foreground">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
