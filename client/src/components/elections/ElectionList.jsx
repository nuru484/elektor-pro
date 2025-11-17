"use client";
import { useGetElectionsQuery, useAuthUserQuery } from "@/redux/api/apiSlice";
import { Users, AlertCircle, Plus } from "lucide-react";
import { ElectionListItem } from "./ElectionListItem";
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

export const ElectionList = () => {
  const {
    data: elections = [],
    isLoading,
    error,
    refetch,
  } = useGetElectionsQuery();
  const { data: userData } = useAuthUserQuery();
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(userData?.user?.role);
  const router = useRouter();

  const handleCreateElection = () => {
    router.push("/dashboard/elections/new");
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
              Error loading elections: {error.data?.error || "Unknown error"}
            </span>
            <Button
              onClick={refetch}
              className="w-fit mx-auto"
              aria-label="Retry loading elections"
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
            aria-label="Elections Management"
          >
            Elections Management
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Manage and monitor all elections
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={handleCreateElection}
            className="w-fit self-start sm:self-auto"
            aria-label="Create new election"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Election
          </Button>
        )}
      </div>

      {elections.length === 0 ? (
        <div className="text-center py-12">
          <Users
            className="mx-auto h-12 w-12 text-muted-foreground mb-4"
            aria-hidden="true"
          />
          <p
            className="text-muted-foreground text-sm sm:text-base mb-4"
            aria-label="No elections found"
          >
            No elections found
          </p>
          {isAdmin && (
            <Button
              onClick={handleCreateElection}
              variant="outline"
              className="mx-auto"
              aria-label="Create your first election"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Election
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sm:px-6">
                    Election
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sm:px-6">
                    Status
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sm:px-6">
                    Start Date
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sm:px-6">
                    End Date
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sm:px-6">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {elections.map((election) => (
                  <ElectionListItem key={election.id} election={election} />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};
