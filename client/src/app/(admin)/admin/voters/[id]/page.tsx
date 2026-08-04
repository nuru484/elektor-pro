"use client";

// Voter profile: identity, contact, and the group memberships that decide
// which scoped elections they can vote in.
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  CARD_MOBILE,
  CARD_PAD_MOBILE,
} from "@/components/profile/details-section";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useGetVoterQuery } from "@/redux/admin-api";

export default function VoterProfilePage() {
  const params = useParams<{ id: string }>();
  const { data, isError, isLoading } = useGetVoterQuery(params.id);
  const voter = data?.data;

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        href="/admin/voters"
      >
        <ArrowLeft className="size-4" /> Back to voters
      </Link>

      {isLoading ? (
        <CardGridSkeleton count={2} />
      ) : isError || !voter ? (
        <ErrorState />
      ) : (
        <div className="space-y-6 max-sm:space-y-8">
          <Card className={CARD_MOBILE}>
            <CardContent className={`${CARD_PAD_MOBILE} flex items-center gap-4 py-6`}>
              <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-brand text-lg font-semibold text-brand-foreground">
                {voter.profilePicture ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Cloudinary avatar
                  <img alt="" className="size-full object-cover" src={voter.profilePicture} />
                ) : (
                  voter.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold">{voter.name}</h1>
                <p className="mt-0.5 font-mono text-sm text-muted-foreground">
                  {voter.voterId}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className={CARD_MOBILE}>
            <CardHeader className={CARD_PAD_MOBILE}>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className={CARD_PAD_MOBILE}>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Phone</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {voter.phoneNumber ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd className="mt-0.5 break-words text-sm font-medium">
                    {voter.email ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Registered</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {voter.createdAt
                      ? new Date(voter.createdAt).toLocaleDateString()
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Groups</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {voter.groupMemberships?.length ? (
                      voter.groupMemberships.map((membership) => (
                        <Badge key={membership.group.id} variant="outline">
                          {membership.group.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">None</span>
                    )}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
