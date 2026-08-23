// The page's one split layout: the heading holds the left column while the
// questions scroll past it on the right. Native details/summary, so the
// accordion works before any JavaScript loads. An open row turns blue and
// grows a rule down its left edge.
import { ChevronDown } from "lucide-react";

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
    <section className="scroll-mt-24 py-20 md:py-28" id="faq">
      <div className="mx-auto grid w-full max-w-[100rem] gap-12 px-5 md:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20 lg:px-12">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <h2
            data-reveal
            className="display max-w-[10ch] text-[clamp(2.4rem,5vw,4.5rem)]"
          >
            Questions, answered
          </h2>
          <p className="mt-6 max-w-sm text-lg leading-relaxed text-muted-foreground">
            The things organizers and voters ask before their first election on
            the platform.
          </p>
        </div>

        <div className="lg:pt-3">
          {FAQS.map((faq) => (
            <details
              className="group border-b border-foreground/25 open:border-l-2 open:border-l-brand open:pl-5"
              key={faq.question}
            >
              <summary className="flex list-none items-start gap-4 py-6 [&::-webkit-details-marker]:hidden">
                <ChevronDown
                  aria-hidden
                  className="mt-1.5 size-5 flex-none text-muted-foreground transition-transform duration-200 group-open:rotate-180 group-open:text-brand"
                />
                <span className="font-display text-xl font-semibold transition-colors group-open:text-brand md:text-2xl">
                  {faq.question}
                </span>
              </summary>
              <p className="max-w-[60ch] pb-7 pl-9 text-lg leading-relaxed text-muted-foreground">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
