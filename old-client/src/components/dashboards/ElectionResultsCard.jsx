// src/components/dashboards/ElectionResultsCard.jsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  Clock,
  Trophy,
  Users,
  Vote,
  ChartNoAxesCombined,
} from "lucide-react";
import { DashboardSummaryCard } from "./DashboardSummaryCard";

export const ElectionResultsCard = ({ election, isAdmin }) => {
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

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

  const statusConfig = getStatusConfig(election.status);
  const StatusIcon = statusConfig.icon;
  const showResults = isAdmin || election.status === "ENDED";

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-muted/80 to-muted/40 border-b border-border/50 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-foreground">
                {election.electionName}
              </h3>
              <Badge className={`${statusConfig.color} font-medium px-3 py-1`}>
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
      <CardContent className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <DashboardSummaryCard
            title="Total Voters"
            value={election.summary.totalVoters}
            icon={Users}
          />
          <DashboardSummaryCard
            title="Votes Cast"
            value={election.summary.totalVotesCast}
            icon={Vote}
          />
          <DashboardSummaryCard
            title="Turnout %"
            value={`${election.summary.turnoutPercentage}%`}
            icon={ChartNoAxesCombined}
          />
          <DashboardSummaryCard
            title="Candidates"
            value={election.summary.totalCandidates}
            icon={Users}
          />
        </div>
        {showResults && election.portfolios.length > 0 ? (
          <div className="space-y-8">
            {election.portfolios.map((portfolio) => (
              <div key={portfolio.portfolioId} className="space-y-4">
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
                          Candidate
                        </TableHead>
                        <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Party
                        </TableHead>
                        <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Votes
                        </TableHead>
                        <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Percentage
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {portfolio.candidates.map((candidate) => (
                        <TableRow
                          key={candidate.id}
                          className="hover:bg-muted/30"
                        >
                          <TableCell className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center border-2 border-border/50">
                                {candidate.profilePicture ? (
                                  <img
                                    src={candidate.profilePicture}
                                    alt={candidate.name}
                                    className="h-full w-full rounded-full object-cover"
                                  />
                                ) : (
                                  <span className="text-primary font-semibold text-sm">
                                    {candidate.name
                                      .split(" ")
                                      .map((word) => word.charAt(0))
                                      .join("")
                                      .toUpperCase()
                                      .slice(0, 2)}
                                  </span>
                                )}
                              </div>
                              <span className="font-medium">
                                {candidate.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            {candidate.party || "N/A"}
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            {candidate.voteCount}
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            {candidate.percentage}%
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="hover:bg-muted/30">
                        <TableCell className="py-4 px-6 font-medium">
                          Skipped Votes
                        </TableCell>
                        <TableCell className="py-4 px-6">-</TableCell>
                        <TableCell className="py-4 px-6">
                          {portfolio.skipVotes}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          {portfolio.skipPercentage}%
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                {portfolio.winner && (
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      Winner: {portfolio.winner.name} (
                      {portfolio.winner.percentage}%)
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">
            {isAdmin
              ? "No results available for this election."
              : "Results will be available after the election ends."}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
