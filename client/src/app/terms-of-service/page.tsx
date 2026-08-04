// Terms of service for Elektor Pro. Kept honest to how the platform really
// works (secret ballots, receipts, certification, role-based access) - if
// behavior changes, this document must change with it.
import type { Metadata } from "next";

import {
  LegalLink,
  LegalPageShell,
  LegalSection,
  LegalStrong,
  LegalText,
  LegalList,
} from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  alternates: { canonical: "/terms-of-service" },
  description:
    "The rules for using Elektor Pro: accounts, voting conduct, election integrity, results, and liability.",
  title: "Terms of Service",
};

export default function TermsOfServicePage() {
  return (
    <LegalPageShell
      crossLink={{ href: "/privacy-policy", label: "Privacy Policy" }}
      lastUpdated="August 4, 2026"
      title="Terms of Service"
    >
      <LegalSection title="1. What these terms cover">
        <LegalText>
          These terms govern the use of Elektor Pro, an electronic voting
          platform on which organizations run their elections. They apply to
          everyone who uses it: the organizations that set elections up, the
          staff who administer them, and the voters who cast ballots. By
          using the platform you accept these terms and the{" "}
          <LegalLink href="/privacy-policy">Privacy Policy</LegalLink>.
        </LegalText>
      </LegalSection>

      <LegalSection title="2. The service">
        <LegalText>
          Elektor Pro lets organizations create elections, manage voter
          rolls, candidates and portfolios, collect secret ballots, and
          publish verifiable, certified results. Ballots are stored without
          any link to the voter; every voter receives a receipt code that
          proves their ballot entered the count without revealing how it was
          cast.
        </LegalText>
      </LegalSection>

      <LegalSection title="3. Accounts and access">
        <LegalList
          items={[
            <>
              You must keep your sign-in details private. One-time codes and
              passwords are personal:{" "}
              <LegalStrong>never share or sell access</LegalStrong> to your
              account.
            </>,
            <>
              Access is role-based. You may only use the functions your role
              and permissions grant, and only for the elections you belong
              to.
            </>,
            <>
              You are responsible for activity performed with your account
              until you report it compromised to your organization or to the
              contact below.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Organizer responsibilities">
        <LegalText>
          Organizations that run elections on the platform are responsible
          for their electorate data and their election&apos;s rules. In
          particular, an organizer must:
        </LegalText>
        <LegalList
          items={[
            <>
              have the right to load the voter roll it uploads, and keep it
              accurate;
            </>,
            <>
              configure eligibility honestly - who may vote, and in which
              contests;
            </>,
            <>
              conduct the election lawfully under its own constitution,
              rules, and applicable law.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Voting conduct and election integrity">
        <LegalText>
          The platform enforces one ballot per voter per election and keeps
          ballots secret by construction. In using it, you agree not to:
        </LegalText>
        <LegalList
          items={[
            <>vote, or attempt to vote, as anyone other than yourself;</>,
            <>buy, sell, or coerce votes, receipts, or sign-in codes;</>,
            <>
              attempt to link ballots to voters, defeat ballot anonymity, or
              tamper with counts, receipts, or audit records;
            </>,
            <>
              probe, overload, scrape, or otherwise attack the service, or
              bypass its security or rate limits.
            </>,
          ]}
        />
        <LegalText>
          Violations can lead to suspended accounts, invalidated actions, and
          referral to the organization running the election or to law
          enforcement where the law requires it.
        </LegalText>
      </LegalSection>

      <LegalSection title="6. Results and certification">
        <LegalText>
          Results become official when the responsible official certifies
          them; certification seals a snapshot of the count whose integrity
          can be re-verified. Receipt verification tells you whether a ballot
          entered the certified count. Disputes about an election&apos;s
          conduct or outcome are resolved by the organization that ran it
          under its own rules - the platform provides the evidence, not the
          ruling.
        </LegalText>
      </LegalSection>

      <LegalSection title="7. Availability">
        <LegalText>
          We work to keep the platform available and fast, especially while
          polls are open, but no online service can promise uninterrupted
          availability. Scheduled maintenance is kept away from live voting
          windows wherever possible.
        </LegalText>
      </LegalSection>

      <LegalSection title="8. Intellectual property">
        <LegalText>
          The platform, its design, and its software remain the property of
          the developer. Organizations retain ownership of their own data -
          voter rolls, candidate information, and election content.
        </LegalText>
      </LegalSection>

      <LegalSection title="9. Liability">
        <LegalText>
          The platform is provided &quot;as is&quot;. To the fullest extent
          the law allows, the developer is not liable for indirect or
          consequential losses arising from use of the platform, including
          losses caused by an organizer&apos;s misconfiguration of its own
          election. Nothing in these terms excludes liability that cannot
          lawfully be excluded.
        </LegalText>
      </LegalSection>

      <LegalSection title="10. Termination">
        <LegalText>
          An organization may stop using the platform at any time. Accounts
          that break these terms may be suspended or removed. Sections that
          by their nature should survive (integrity of past records,
          liability, disputes) survive termination.
        </LegalText>
      </LegalSection>

      <LegalSection title="11. Changes to these terms">
        <LegalText>
          If these terms change, this document will be updated with a new
          date at the top. Continued use after a change means you accept the
          updated terms.
        </LegalText>
      </LegalSection>

      <LegalSection title="12. Contact">
        <LegalText>
          Questions about these terms:{" "}
          <LegalLink external href="mailto:abdulmajeednurudeen48@gmail.com">
            abdulmajeednurudeen48@gmail.com
          </LegalLink>
          . See also the{" "}
          <LegalLink href="/privacy-policy">Privacy Policy</LegalLink>.
        </LegalText>
      </LegalSection>
    </LegalPageShell>
  );
}
