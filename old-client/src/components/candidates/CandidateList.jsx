"use client";
import {
  useGetCandidatesByElectionQuery,
  useAuthUserQuery,
} from "@/redux/api/apiSlice";
import {
  Users,
  AlertCircle,
  Plus,
  Calendar,
  Clock,
  Trophy,
  Vote,
} from "lucide-react";
import { CandidateListItem } from "./CandidateListItem";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const CandidateList = () => {
  const {
    data: candidatesByElection = [],
    isLoading,
    error,
    refetch,
  } = useGetCandidatesByElectionQuery();
  const { data: userData } = useAuthUserQuery();
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(userData?.user?.role);
  const router = useRouter();

  const handleCreateCandidate = () => {
    router.push("/dashboard/candidates/new");
  };

  // Helper function to format dates
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Status configuration
  const getStatusConfig = (status) => {
    const configs = {
      IN_PROGRESS: {
        color:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
        icon: Clock,
        label: "Active",
      },
      UPCOMING: {
        color:
          "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
        icon: Calendar,
        label: "Upcoming",
      },
      ENDED: {
        color:
          "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-300 dark:border-gray-800",
        icon: Trophy,
        label: "Completed",
      },
      PAUSED: {
        color:
          "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
        icon: Clock,
        label: "Paused",
      },
    };
    return configs[status] || configs.UPCOMING;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[20rem]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading candidates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[20rem] px-4">
        <Alert
          variant="destructive"
          className="max-w-md w-full border-0 shadow-lg"
        >
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
          <AlertTitle className="text-base">Something went wrong</AlertTitle>
          <AlertDescription className="flex flex-col gap-4">
            <span className="text-sm">
              {error.data?.error ||
                "Failed to load candidates. Please try again."}
            </span>
            <Button
              onClick={refetch}
              variant="outline"
              size="sm"
              className="w-fit"
              aria-label="Retry loading candidates"
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Filter elections to only those with at least one candidate
  const filteredElections = candidatesByElection.filter((election) =>
    election.portfolios.some((portfolio) => portfolio.candidates.length > 0)
  );

  const hasCandidates = filteredElections.length > 0;

  const totalCandidates = filteredElections.reduce(
    (total, election) =>
      total +
      election.portfolios.reduce(
        (subTotal, portfolio) => subTotal + portfolio.candidates.length,
        0
      ),
    0
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8">
      {/* Header Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent rounded-2xl"></div>
        <div className="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Vote className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground tracking-tight">
                    Candidates
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Manage and monitor all candidates across elections
                  </p>
                </div>
              </div>

              {hasCandidates && (
                <div className="flex flex-wrap items-center gap-4 mt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span className="font-medium text-foreground">
                      {totalCandidates}
                    </span>
                    <span>Total Candidates</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium text-foreground">
                      {filteredElections.length}
                    </span>
                    <span>Elections</span>
                  </div>
                </div>
              )}
            </div>

            {isAdmin && (
              <Button
                onClick={handleCreateCandidate}
                className="w-fit bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
                size="lg"
                aria-label="Create new candidate"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Candidate
              </Button>
            )}
          </div>
        </div>
      </div>

      {!hasCandidates ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="text-center py-16">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl"></div>
                <div className="relative rounded-full bg-gradient-to-br from-primary/10 to-primary/20 p-6">
                  <Users
                    className="h-12 w-12 text-primary"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
            <h3 className="text-2xl font-semibold text-foreground mb-3">
              No candidates yet
            </h3>
            <p className="text-muted-foreground text-base mb-8 max-w-md mx-auto leading-relaxed">
              Get started by creating your first candidate. Candidates represent
              individuals running for positions in elections.
            </p>
            {isAdmin && (
              <Button
                onClick={handleCreateCandidate}
                size="lg"
                className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
                aria-label="Create your first candidate"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Candidate
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredElections.map((election) => {
            const statusConfig = getStatusConfig(election.status);
            const StatusIcon = statusConfig.icon;

            return (
              <Card
                key={election.electionId}
                className="border-0 shadow-lg overflow-hidden"
              >
                {/* Election Header */}
                <CardHeader className="bg-gradient-to-r from-muted/80 to-muted/40 border-b border-border/50 p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-foreground">
                          {election.electionName}
                        </h3>
                        <Badge
                          className={`${statusConfig.color} font-medium px-3 py-1`}
                        >
                          <StatusIcon className="h-3 w-3 mr-1.5" />
                          {statusConfig.label}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span className="font-medium">Start:</span>
                          <span>{formatDate(election.startDate)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span className="font-medium">End:</span>
                          <span>{formatDate(election.endDate)}</span>
                        </div>
                      </div>

                      {election.description && (
                        <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
                          {election.description}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {/* Portfolios and Candidates */}
                <CardContent className="p-6">
                  <div className="space-y-8">
                    {election.portfolios
                      .filter((portfolio) => portfolio.candidates.length > 0)
                      .map((portfolio) => {
                        // Generate candidate numbers for this portfolio
                        let candidateNumber = 1;

                        return (
                          <div
                            key={portfolio.portfolioId}
                            className="space-y-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-px bg-gradient-to-r from-border via-border/50 to-transparent flex-1"></div>
                              <h4 className="text-lg font-semibold text-foreground px-4 py-2 bg-muted/50 rounded-full">
                                {portfolio.portfolioName}
                              </h4>
                              <div className="h-px bg-gradient-to-l from-border via-border/50 to-transparent flex-1"></div>
                            </div>

                            <div className="bg-card/50 rounded-xl border border-border/50 overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-b border-border/50 bg-muted/30">
                                    <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                      #
                                    </TableHead>
                                    <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                      Candidate
                                    </TableHead>
                                    <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                      Details
                                    </TableHead>
                                    <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                      Actions
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {portfolio.candidates.map((candidate) => (
                                    <CandidateListItem
                                      key={candidate.id}
                                      candidate={candidate}
                                      candidateNumber={candidateNumber++}
                                      electionName={election.electionName}
                                    />
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
