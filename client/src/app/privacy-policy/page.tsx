// Privacy policy for Elektor Pro. Every claim mirrors what the platform
// actually does (anonymous hash-chained ballots, httpOnly cookie sessions,
// hashed OTPs, audit logs with IP/device data) - if those change, this
// document must change with them.
import type { Metadata } from "next";

import {
  LegalLink,
  LegalList,
  LegalPageShell,
  LegalSection,
  LegalStrong,
  LegalText,
} from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  alternates: { canonical: "/privacy-policy" },
  description:
    "How Elektor Pro handles your data: what is collected, how ballot secrecy is protected, and who to contact.",
  title: "Privacy Policy",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      crossLink={{ href: "/terms-of-service", label: "Terms of Service" }}
      lastUpdated="August 4, 2026"
      title="Privacy Policy"
    >
      <LegalSection title="1. Introduction">
        <LegalText>
          Elektor Pro is an electronic voting platform that organizations -
          unions, universities, associations and similar bodies - use to run
          their elections. This policy explains plainly what data the platform
          handles, how ballot secrecy is protected, and how to reach us about
          any of it.
        </LegalText>
        <LegalText>
          By using the platform you agree to the practices described here.
        </LegalText>
      </LegalSection>

      <LegalSection title="2. Who runs the platform">
        <LegalList
          items={[
            <>
              <LegalStrong>Developer:</LegalStrong> Nurudeen Abdul-Majeed
            </>,
            <>
              <LegalStrong>Website:</LegalStrong>{" "}
              <LegalLink external href="https://manuru.dev">
                manuru.dev
              </LegalLink>
            </>,
            <>
              <LegalStrong>Email:</LegalStrong>{" "}
              <LegalLink external href="mailto:abdulmajeednurudeen48@gmail.com">
                abdulmajeednurudeen48@gmail.com
              </LegalLink>
            </>,
          ]}
        />
        <LegalText>
          When an organization runs its election on Elektor Pro, that
          organization decides who is on the voter roll and which staff
          accounts exist; the platform processes that data to run the election
          on the organization&apos;s behalf.
        </LegalText>
      </LegalSection>

      <LegalSection title="3. Information the platform collects">
        <LegalText>
          <LegalStrong>3.1 Staff accounts.</LegalStrong> Administrators,
          agents, candidates and accreditation staff have accounts with a
          name, an email address and/or phone number, an optional profile
          photo, and a password stored only as a one-way bcrypt hash - the
          platform never sees or stores a password in readable form.
        </LegalText>
        <LegalText>
          <LegalStrong>3.2 Voter records.</LegalStrong> The organization
          running an election loads its voter roll: a name, a voter ID, and a
          phone number and/or email address used to sign in with one-time
          codes. Group memberships (for example a department or college) may
          be attached so the right elections are shown to the right voters.
        </LegalText>
        <LegalText>
          <LegalStrong>3.3 One-time codes.</LegalStrong> Sign-in and
          verification codes are sent to the contact details on record,
          stored only as hashes, expire quickly, and are single-use.
        </LegalText>
        <LegalText>
          <LegalStrong>3.4 Security records.</LegalStrong> The platform keeps
          an append-only audit log of sensitive actions (sign-ins, changes to
          election data, certifications) which records the acting account,
          the action, and the IP address and browser identification of the
          request. Active sessions are recorded per device so you can review
          and revoke them.
        </LegalText>
        <LegalText>
          <LegalStrong>3.5 Nothing else.</LegalStrong> There are no analytics
          trackers, no advertising cookies, and no profiling of any kind.
        </LegalText>
      </LegalSection>

      <LegalSection title="4. Your ballot is not linked to you">
        <LegalText>
          This is the heart of the platform&apos;s design: a cast ballot is
          stored with <LegalStrong>no reference to the voter</LegalStrong>.
          The system records separately <LegalStrong>that</LegalStrong> you
          voted in an election (so nobody can vote twice) and{" "}
          <LegalStrong>what</LegalStrong> was voted (the anonymous ballot),
          and the two cannot be joined - not by administrators, not by the
          developer. Your receipt code proves your ballot entered the count
          without revealing how it was cast.
        </LegalText>
      </LegalSection>

      <LegalSection title="5. How your data is used">
        <LegalText>
          Data is used for exactly one purpose: running elections - signing
          you in, showing you the elections you belong to, delivering
          one-time codes, counting ballots, publishing certified results, and
          keeping the security records above. It is never sold, shared,
          rented, used for advertising, or used to train models.
        </LegalText>
      </LegalSection>

      <LegalSection title="6. Cookies">
        <LegalText>
          The platform sets only strictly necessary cookies: httpOnly access
          and refresh tokens that keep you signed in, and a simple
          non-identifying marker that tells the website a session exists.
          There are no analytics, advertising, or cross-site tracking
          cookies.
        </LegalText>
      </LegalSection>

      <LegalSection title="7. Security">
        <LegalText>
          The platform is built to production security standards: bcrypt
          password hashing, short-lived session tokens in httpOnly cookies
          with refresh-token rotation and replay detection, optional
          two-factor authentication, account lockout, rate limiting, hashed
          single-use codes, hash-chained ballots and audit logs whose
          integrity can be re-verified, and encrypted connections throughout.
          Still, no online system is completely secure; report any concern to
          the contact below.
        </LegalText>
      </LegalSection>

      <LegalSection title="8. Retention and deletion">
        <LegalText>
          Election records are kept so that past results remain checkable -
          that permanence is a feature organizations rely on. Voter and staff
          records are kept while the organization uses the platform and are
          removed when the organization asks or ends its use. To have your
          own details corrected or removed, contact the organization that
          runs your election, or email the address below.
        </LegalText>
      </LegalSection>

      <LegalSection title="9. Infrastructure and processors">
        <LegalText>
          The platform runs on ordinary cloud infrastructure: a website host,
          an API host, a managed PostgreSQL database, and Cloudinary for
          profile photos. Email and SMS providers deliver one-time codes and
          notifications. These providers process data only to run the
          application; no third party receives your data for its own
          purposes.
        </LegalText>
      </LegalSection>

      <LegalSection title="10. Children">
        <LegalText>
          The platform is used by organizations whose electorates are adults
          or students of voting age within those organizations; no data is
          knowingly collected from children outside that context.
        </LegalText>
      </LegalSection>

      <LegalSection title="11. Changes to this policy">
        <LegalText>
          If the platform&apos;s data practices change, this document will be
          updated with a new date at the top. Continued use after a change
          means you accept the updated policy.
        </LegalText>
      </LegalSection>

      <LegalSection title="12. Contact">
        <LegalText>
          Questions, correction or deletion requests, or security reports:{" "}
          <LegalLink external href="mailto:abdulmajeednurudeen48@gmail.com">
            abdulmajeednurudeen48@gmail.com
          </LegalLink>
          . See also the{" "}
          <LegalLink href="/terms-of-service">Terms of Service</LegalLink>.
        </LegalText>
      </LegalSection>
    </LegalPageShell>
  );
}
