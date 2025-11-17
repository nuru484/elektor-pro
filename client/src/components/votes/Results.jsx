"use client";
import { useState, useEffect } from "react";
import { useGetElectionQuery } from "@/redux/api/apiSlice";
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
import { Calendar, Users, Vote } from "lucide-react";
import io from "socket.io-client";
import { toast } from "react-hot-toast";

export default function ElectionResults({ electionId }) {
  const {
    data: electionData,
    isLoading,
    error,
  } = useGetElectionQuery(electionId);
  const [results, setResults] = useState([]);
  const [totalVoters, setTotalVoters] = useState(0);
  const [votersVoted, setVotersVoted] = useState(0);
  const [votersRemaining, setVotersRemaining] = useState(0);
  const [skippedVotes, setSkippedVotes] = useState([]);

  useEffect(() => {
    const socket = io();
    socket.emit("joinElection", electionId);

    socket.on(
      "voteUpdate",
      ({
        results,
        totalVoters,
        votersVoted,
        votersRemaining,
        skippedVotes,
      }) => {
        setResults(results.sort((a, b) => b.votes - a.votes)); // Sort by votes descending
        setTotalVoters(totalVoters);
        setVotersVoted(votersVoted);
        setVotersRemaining(votersRemaining);
        setSkippedVotes(skippedVotes);
        toast.success("Election results updated!");
      }
    );

    return () => {
      socket.disconnect();
    };
  }, [electionId]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">Loading election results...</div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-destructive">
          {error?.data?.error || "Failed to load election results."}
        </p>
      </div>
    );
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8">
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-muted/80 to-muted/40">
          <CardTitle className="flex items-center gap-3">
            <Vote className="h-6 w-6 text-primary" />
            <span>{electionData?.name} - Results</span>
          </CardTitle>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Start: {formatDate(electionData?.startDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>End: {formatDate(electionData?.endDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Total Voters: {totalVoters}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Voted: {votersVoted}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Remaining: {votersRemaining}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          {electionData?.portfolios?.map((portfolio) => {
            const portfolioResults = results.filter(
              (result) => result.portfolioId === portfolio.id
            );
            const skipped =
              skippedVotes.find((s) => s.portfolioId === portfolio.id)
                ?.skipped || 0;

            return (
              <div key={portfolio.id} className="space-y-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold">{portfolio.name}</h3>
                  <Badge variant="secondary">Skipped Votes: {skipped}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Votes</TableHead>
                      <TableHead>Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolioResults.length > 0 ? (
                      portfolioResults.map((result) => (
                        <TableRow key={result.candidateId}>
                          <TableCell>{result.candidateName}</TableCell>
                          <TableCell>{result.votes}</TableCell>
                          <TableCell>{result.percentage.toFixed(2)}%</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center">
                          No votes cast for this portfolio yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
