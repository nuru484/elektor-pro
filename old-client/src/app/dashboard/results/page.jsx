// src/app/dashboard/results/page.jsx
"use client";
import { useState, useEffect } from "react";
import {
  useGetElectionsQuery,
  useGetElectionResultsQuery,
  useAuthUserQuery,
} from "@/redux/api/apiSlice";
import { io } from "socket.io-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  User,
  Trophy,
  Vote,
  BarChart3,
  Crown,
  RefreshCw,
  TrendingUp,
  Clock,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ElectionResults = () => {
  const [selectedElection, setSelectedElection] = useState(null);
  const [socket, setSocket] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: userData, isLoading: isLoadingUser } = useAuthUserQuery();
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(userData?.user?.role);

  const {
    data: elections = [],
    isLoading: isLoadingElections,
    error: electionsError,
  } = useGetElectionsQuery();

  const {
    data: results,
    isLoading: isLoadingResults,
    error: resultsError,
    refetch,
  } = useGetElectionResultsQuery(selectedElection?.id, {
    skip: !selectedElection,
  });

  // Initialize socket connection for real-time updates (only for admins or ended elections)
  useEffect(() => {
    if (selectedElection && (isAdmin || selectedElection.status === "ENDED")) {
      const newSocket = io();
      setSocket(newSocket);

      newSocket.emit("joinElection", selectedElection.id);

      newSocket.on("voteUpdate", () => {
        if (autoRefresh) {
          refetch();
          setLastUpdated(new Date());
        }
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [selectedElection, autoRefresh, refetch, isAdmin]);

  // Auto-refresh every 30 seconds (only for admins or ended elections)
  useEffect(() => {
    if (
      selectedElection &&
      autoRefresh &&
      (isAdmin || selectedElection.status === "ENDED")
    ) {
      const interval = setInterval(() => {
        refetch();
        setLastUpdated(new Date());
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [selectedElection, autoRefresh, refetch, isAdmin]);

  // Handle errors
  useEffect(() => {
    if (electionsError) {
      toast.error("Failed to load elections. Please try again.");
    }
  }, [electionsError]);

  useEffect(() => {
    if (resultsError) {
      toast.error(
        resultsError?.data?.error ||
          "Failed to fetch election results. Please try again."
      );
    }
  }, [resultsError]);

  const handleElectionChange = (electionId) => {
    const election = elections.find((el) => el.id === parseInt(electionId));
    setSelectedElection(election);
  };

  const handleRefresh = () => {
    refetch();
    setLastUpdated(new Date());
  };

  if (isLoadingUser || isLoadingElections) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex justify-center items-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            Loading elections...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Election Results
          </h1>
          <p className="text-muted-foreground text-lg">
            {isAdmin
              ? "Real-time election results and analytics"
              : "View results for completed elections"}
          </p>
        </div>

        {/* Election Selection */}
        <Card className="mb-8 shadow-lg border-0 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Select Election
            </CardTitle>
            <CardDescription>
              Choose an election to view its results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <Select
                value={selectedElection?.id?.toString() || ""}
                onValueChange={handleElectionChange}
              >
                <SelectTrigger className="w-full sm:w-96 h-12 text-base">
                  <SelectValue placeholder="Choose an election" />
                </SelectTrigger>
                <SelectContent>
                  {elections.map((election) => (
                    <SelectItem
                      key={election.id}
                      value={election.id.toString()}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">{election.name}</span>
                        <Badge variant="secondary" className="ml-2">
                          {election.status}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleRefresh}
                  disabled={
                    isLoadingResults ||
                    !selectedElection ||
                    (!isAdmin && selectedElection?.status !== "ENDED")
                  }
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${
                      isLoadingResults ? "animate-spin" : ""
                    }`}
                  />
                  Refresh
                </Button>

                <Button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  variant={autoRefresh ? "default" : "outline"}
                  size="sm"
                  disabled={!isAdmin && selectedElection?.status !== "ENDED"}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Auto-refresh
                </Button>
              </div>
            </div>

            {lastUpdated &&
              (isAdmin || selectedElection?.status === "ENDED") && (
                <p className="text-sm text-muted-foreground mt-2">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
              )}
          </CardContent>
        </Card>

        {/* Results Display */}
        {selectedElection && (
          <div className="space-y-8">
            {isLoadingResults ? (
              <div className="flex justify-center items-center py-16">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">
                    Loading results...
                  </p>
                </div>
              </div>
            ) : results ? (
              !isAdmin && selectedElection.status !== "ENDED" ? (
                <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
                  <CardContent className="text-center py-16">
                    <Alert variant="default" className="max-w-md mx-auto">
                      <AlertCircle className="h-5 w-5" />
                      <AlertTitle className="text-base">
                        Results Unavailable
                      </AlertTitle>
                      <AlertDescription className="text-sm">
                        Results for this election will be available after it has
                        ended.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Election Summary */}
                  <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-2xl text-primary flex items-center gap-2">
                        <Trophy className="h-6 w-6" />
                        {results.election.name}
                      </CardTitle>
                      <CardDescription className="text-base">
                        {results.election.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-primary mb-2">
                            {results.summary.totalVoters}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Registered Voters
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-green-600 mb-2">
                            {results.summary.totalVotesCast}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Votes Cast
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-600 mb-2">
                            {results.summary.turnoutPercentage}%
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Turnout
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-purple-600 mb-2">
                            {results.summary.totalPortfolios}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Portfolios
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Portfolio Results */}
                  <div className="space-y-6">
                    {results.portfolios.map((portfolio) => (
                      <Card
                        key={portfolio.portfolioId}
                        className="shadow-lg border-0 bg-card/50 backdrop-blur-sm"
                      >
                        <CardHeader className="pb-4">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-xl">
                              {portfolio.portfolioName}
                            </CardTitle>
                            <Badge variant="secondary" className="text-sm">
                              {portfolio.totalVotes} total votes
                            </Badge>
                          </div>
                          {portfolio.portfolioDescription && (
                            <CardDescription>
                              {portfolio.portfolioDescription}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent>
                          {/* Winner Display */}
                          {portfolio.winner && (
                            <div className="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                              <div className="flex items-center gap-4">
                                <div className="flex-shrink-0">
                                  <Crown className="h-8 w-8 text-yellow-600" />
                                </div>
                                <div className="flex items-center gap-4 flex-1">
                                  <Avatar className="w-12 h-12 ring-2 ring-yellow-400">
                                    <AvatarImage
                                      src={portfolio.winner.profilePicture}
                                      alt={portfolio.winner.name}
                                    />
                                    <AvatarFallback>
                                      <User className="h-6 w-6" />
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-semibold text-foreground flex items-center gap-2">
                                      <span>{portfolio.winner.name}</span>
                                      <Badge
                                        variant="default"
                                        className="bg-yellow-600"
                                      >
                                        WINNER
                                      </Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {portfolio.winner.party}
                                      {portfolio.winner.partySymbol &&
                                        ` (${portfolio.winner.partySymbol})`}
                                    </div>
                                    <div className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                                      {portfolio.winner.voteCount} votes (
                                      {portfolio.winner.percentage}%)
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Candidates Results */}
                          <div className="space-y-4">
                            {portfolio.candidates.map((candidate, index) => (
                              <div
                                key={candidate.id}
                                className="flex items-center gap-4 p-4 rounded-lg border bg-card/30"
                              >
                                <div className="flex-shrink-0">
                                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                    {index + 1}
                                  </div>
                                </div>
                                <Avatar className="w-12 h-12 ring-2 ring-primary/20">
                                  <AvatarImage
                                    src={candidate.profilePicture}
                                    alt={candidate.name}
                                  />
                                  <AvatarFallback>
                                    <User className="h-6 w-6" />
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <div className="font-semibold text-foreground flex items-center gap-2">
                                        <span>{candidate.name}</span>
                                        {index === 0 &&
                                          candidate.voteCount > 0 && (
                                            <Trophy className="h-4 w-4 text-yellow-600" />
                                          )}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {candidate.party}
                                        {candidate.partySymbol &&
                                          ` (${candidate.partySymbol})`}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-lg font-bold text-foreground">
                                        {candidate.voteCount}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {candidate.percentage}%
                                      </div>
                                    </div>
                                  </div>
                                  <Progress
                                    value={candidate.percentage}
                                    className="h-2"
                                  />
                                </div>
                              </div>
                            ))}

                            {/* Skip Votes */}
                            {portfolio.skipVotes > 0 && (
                              <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
                                <div className="flex-shrink-0">
                                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                    -
                                  </div>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center ring-2 ring-muted-foreground/20">
                                  <Vote className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <div className="font-semibold text-muted-foreground">
                                        Skipped Votes
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        No candidate selected
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-lg font-bold text-muted-foreground">
                                        {portfolio.skipVotes}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {portfolio.skipPercentage}%
                                      </div>
                                    </div>
                                  </div>
                                  <Progress
                                    value={portfolio.skipPercentage}
                                    className="h-2"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )
            ) : (
              <div className="text-center py-16">
                <div className="text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-lg">Select an election to view results</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ElectionResults;
