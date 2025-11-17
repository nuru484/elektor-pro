"use client";
import { useState } from "react";
import { useGetVotersByElectionQuery } from "@/redux/api/apiSlice";
import { Users, AlertCircle, Plus, Upload } from "lucide-react";
import { VoterListItem } from "./VoterListItem";
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
import VoterUpload from "./VoterUpload";

export const VoterList = () => {
  const {
    data: votersByElection = [],
    isLoading,
    error,
    refetch,
  } = useGetVotersByElectionQuery();

  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const router = useRouter();

  const handleCreateVoter = () => {
    router.push("/dashboard/voters/new");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[16rem]">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[16rem] px-4">
        <Alert variant="destructive" className="max-w-md w-full">
          <AlertCircle className="h-6 w-6" aria-hidden="true" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex flex-col gap-4">
            <span
              aria-label={`Error message: ${
                error.data?.error || "Unknown error"
              }`}
            >
              Error loading voters: {error.data?.error || "Unknown error"}
            </span>
            <Button
              onClick={refetch}
              className="w-fit mx-auto"
              aria-label="Retry loading voters"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-foreground"
            aria-label="Voters Management"
          >
            Voters Management
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Manage and monitor all voters
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleCreateVoter}
            className="w-fit self-start sm:self-auto"
            aria-label="Create new voter"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Voter
          </Button>
          <Button
            onClick={() => setIsUploadDialogOpen(true)}
            className="w-fit self-start sm:self-auto"
            aria-label="Upload voters"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Voters
          </Button>
        </div>
      </div>

      {votersByElection.length === 0 ||
      votersByElection.every((e) => e.voters.length === 0) ? (
        <div className="text-center py-12">
          <Users
            className="mx-auto h-12 w-12 text-muted-foreground mb-4"
            aria-hidden="true"
          />
          <p
            className="text-muted-foreground text-sm sm:text-base mb-4"
            aria-label="No voters found"
          >
            No voters found
          </p>
          <Button
            onClick={handleCreateVoter}
            variant="outline"
            className="mx-auto"
            aria-label="Create your first voter"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Voter
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {votersByElection.map((election) =>
            election.voters.length > 0 ? (
              <div
                key={election.electionId}
                className="rounded-lg border bg-card shadow-sm"
              >
                <div className="p-4">
                  <h2 className="text-lg font-semibold text-foreground">
                    {election.electionName}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sm:px-6">
                          Voter
                        </TableHead>
                        <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sm:px-6">
                          Voter ID
                        </TableHead>
                        <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sm:px-6">
                          Phone
                        </TableHead>
                        <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sm:px-6">
                          Created
                        </TableHead>
                        <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sm:px-6">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {election.voters.map((voter) => (
                        <VoterListItem
                          key={voter.id}
                          voter={voter}
                          electionName={election.electionName}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null
          )}
        </div>
      )}
      <VoterUpload
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
      />
    </div>
  );
};

export default VoterList;
