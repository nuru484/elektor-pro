// src/components/dashboards/AdminDashboard.jsx
"use client";
import { useGetAdminDashboardQuery } from "@/redux/api/apiSlice";
import { DashboardSummaryCard } from "./DashboardSummaryCard";
import { ElectionResultsCard } from "./ElectionResultsCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Vote, Users, Calendar } from "lucide-react";

export const AdminDashboard = () => {
  const {
    data: dashboardData,
    isLoading,
    error,
    refetch,
  } = useGetAdminDashboardQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[20rem]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
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
              {error.data?.error || "Failed to load dashboard data."}
            </span>
            <button
              onClick={refetch}
              className="w-fit px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              aria-label="Retry loading dashboard"
            >
              Try Again
            </button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { elections = [] } = dashboardData || {};

  const totalElections = elections.length;
  const totalVoters = elections.reduce(
    (sum, election) => sum + election.summary.totalVoters,
    0
  );
  const totalVotesCast = elections.reduce(
    (sum, election) => sum + election.summary.totalVotesCast,
    0
  );
  const totalCandidates = elections.reduce(
    (sum, election) => sum + election.summary.totalCandidates,
    0
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent rounded-2xl"></div>
        <div className="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Vote className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground tracking-tight">
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground text-sm">
                Overview of all elections and real-time results
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <DashboardSummaryCard
              title="Total Elections"
              value={totalElections}
              icon={Calendar}
            />
            <DashboardSummaryCard
              title="Total Voters"
              value={totalVoters}
              icon={Users}
            />
            <DashboardSummaryCard
              title="Total Votes Cast"
              value={totalVotesCast}
              icon={Vote}
            />
            <DashboardSummaryCard
              title="Total Candidates"
              value={totalCandidates}
              icon={Users}
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {elections.map((election) => (
          <ElectionResultsCard
            key={election.electionId}
            election={election}
            isAdmin
          />
        ))}
      </div>
    </div>
  );
};
