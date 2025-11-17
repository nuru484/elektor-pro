"use client";
import { useState, useEffect } from "react";
import { useGetElectionsQuery } from "@/redux/api/apiSlice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Vote } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchAuditLogs } from "@/lib/api";

async function fetchAuditLogs(electionId) {
  const response = await fetch(`/api/audit-logs?electionId=${electionId}`);
  if (!response.ok) throw new Error("Failed to fetch audit logs");
  return response.json();
}

export default function AuditLogs() {
  const { data: elections = [], isLoading: isLoadingElections } =
    useGetElectionsQuery();
  const [selectedElectionId, setSelectedElectionId] = useState("");

  const {
    data: auditLogs,
    isLoading: isLoadingLogs,
    error,
  } = useQuery({
    queryKey: ["auditLogs", selectedElectionId],
    queryFn: () => fetchAuditLogs(selectedElectionId),
    enabled: !!selectedElectionId,
  });

  if (isLoadingElections) {
    return <div className="max-w-4xl mx-auto p-6">Loading elections...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <span>Audit Logs</span>
          </CardTitle>
          <Select
            value={selectedElectionId}
            onValueChange={setSelectedElectionId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an election" />
            </SelectTrigger>
            <SelectContent>
              {elections.map((election) => (
                <SelectItem key={election.id} value={String(election.id)}>
                  {election.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoadingLogs && <div>Loading audit logs...</div>}
          {error && <div className="text-destructive">{error.message}</div>}
          {auditLogs && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voter</TableHead>
                  <TableHead>Portfolio</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.voter.name}</TableCell>
                    <TableCell>{log.portfolio?.name || "N/A"}</TableCell>
                    <TableCell>{log.actionType}</TableCell>
                    <TableCell>{log.candidate?.name || "N/A"}</TableCell>
                    <TableCell>
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
