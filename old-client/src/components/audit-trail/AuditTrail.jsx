"use client";
import { useState } from "react";
import {
  useGetAuditTrailQuery,
  useGetElectionsQuery,
} from "@/redux/api/apiSlice";
import { useAuthUserQuery } from "@/redux/api/apiSlice";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Users, Vote, AlertCircle, Calendar, FileText } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
export default function AuditTrail() {
  const { data: userData, isLoading: isLoadingUser } = useAuthUserQuery();
  const isSuperAdmin = userData?.user?.role === "SUPER_ADMIN";
  const [selectedElectionId, setSelectedElectionId] = useState("");

  const {
    data: auditData,
    isLoading,
    error,
    refetch,
  } = useGetAuditTrailQuery(
    selectedElectionId ? { electionId: selectedElectionId } : undefined,
    {
      skip: !isSuperAdmin,
    }
  );

  const {
    data: elections = [],
    isLoading: isLoadingElections,
    error: electionsError,
  } = useGetElectionsQuery();

  // Format date helper
  const formatDate = (date) => {
    return new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Handle non-admin access
  if (!isLoadingUser && !isSuperAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            Only Super Admins can access the audit trail.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Handle loading states
  if (isLoading || isLoadingUser) {
    return (
      <div className="flex justify-center items-center min-h-[20rem]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">
            Loading audit trail...
          </p>
        </div>
      </div>
    );
  }

  // Handle error states
  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[20rem] px-4">
        <Alert
          variant="destructive"
          className="max-w-md w-full border-0 shadow-lg"
        >
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription className="flex flex-col gap-4">
            <span className="text-sm">
              {error.data?.error || "Failed to load audit trail data."}
            </span>
            <Button
              onClick={refetch}
              variant="outline"
              size="sm"
              className="w-fit"
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Handle election loading and errors
  if (isLoadingElections) {
    return (
      <div className="flex justify-center items-center min-h-[20rem]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading elections...</p>
        </div>
      </div>
    );
  }

  if (electionsError) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {electionsError?.data?.error || "Failed to load elections."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { auditTrail = [], stats = {} } = auditData || {};

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
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground tracking-tight">
                    Audit Trail
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Detailed record of voter activities and votes across
                    elections
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="font-medium text-foreground">
                    {stats.totalVoters || 0}
                  </span>
                  <span>Total Voters</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Vote className="h-4 w-4" />
                  <span className="font-medium text-foreground">
                    {stats.totalVotes || 0}
                  </span>
                  <span>Total Votes</span>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-64">
              <Select
                onValueChange={setSelectedElectionId}
                value={selectedElectionId}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Filter by Election" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Elections</SelectItem>
                  {elections.map((election) => (
                    <SelectItem key={election.id} value={String(election.id)}>
                      {election.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {stats.votesByElection?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Vote className="h-5 w-5 text-primary" />
                Votes by Election
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.votesByElection}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis dataKey="name" stroke="hsl(var(--foreground))" />
                    <YAxis stroke="hsl(var(--foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Vote className="h-5 w-5 text-primary" />
                Votes by Portfolio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.votesByPortfolio}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis dataKey="name" stroke="hsl(var(--foreground))" />
                    <YAxis stroke="hsl(var(--foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Audit Trail Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Voter Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditTrail.length === 0 ? (
            <div className="text-center py-16">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl"></div>
                  <div className="relative rounded-full bg-gradient-to-br from-primary/10 to-primary/20 p-6">
                    <FileText className="h-12 w-12 text-primary" />
                  </div>
                </div>
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-3">
                No audit records found
              </h3>
              <p className="text-muted-foreground text-base max-w-md mx-auto">
                No voter activity has been recorded yet
                {selectedElectionId ? " for the selected election" : ""}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border/50 bg-muted/30">
                    <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Voter
                    </TableHead>
                    <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Elections
                    </TableHead>
                    <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Votes
                    </TableHead>
                    <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Last Activity
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditTrail.map((voter) => (
                    <TableRow
                      key={voter.voterId}
                      className="hover:bg-muted/30 transition-all duration-200"
                    >
                      <TableCell className="py-6 px-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-base font-semibold text-foreground">
                            {voter.voterName}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {voter.voterUniqueId}
                          </span>
                          {voter.phoneNumber && (
                            <span className="text-sm text-muted-foreground">
                              {voter.phoneNumber}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-6 px-6">
                        <div className="flex flex-col gap-2">
                          {voter.elections.map((election) => (
                            <div
                              key={election.electionId}
                              className="flex items-center gap-2"
                            >
                              <Badge
                                variant="secondary"
                                className="bg-primary/10 text-primary border-primary/20"
                              >
                                {election.electionName}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {election.hasVoted ? "Voted" : "Not Voted"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="py-6 px-6">
                        <div className="flex flex-col gap-2">
                          {voter.votes.map((vote) => (
                            <div
                              key={`${vote.electionId}-${vote.portfolioId}`}
                              className="text-sm"
                            >
                              <span className="font-medium">
                                {vote.electionName}
                              </span>
                              <span className="text-muted-foreground">
                                {" "}
                                &gt;{" "}
                              </span>
                              <span className="font-medium">
                                {vote.portfolioName || "No Portfolio"}
                              </span>
                              <span className="text-muted-foreground">: </span>
                              {vote.actionType === "SKIP" ? (
                                <Badge
                                  variant="outline"
                                  className="border-amber-200 text-amber-700"
                                >
                                  Skipped
                                </Badge>
                              ) : (
                                <span className="text-foreground">
                                  {vote.candidateName}
                                  {vote.candidateParty && (
                                    <span className="text-muted-foreground">
                                      {" (" + vote.candidateParty + ")"}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="py-6 px-6 text-sm text-muted-foreground">
                        {voter.votes.length > 0
                          ? formatDate(
                              voter.votes[voter.votes.length - 1].timestamp
                            )
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
