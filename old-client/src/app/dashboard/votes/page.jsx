// src/app/dashboard/votes/page.jsx
"use client";
import { useState, useEffect } from "react";
import {
  useGetElectionsQuery,
  useGetCandidatesByElectionQuery,
  useVoteMutation,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, SkipForward, Vote, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

const VotingInterface = () => {
  const [selectedElection, setSelectedElection] = useState(null);
  const [votes, setVotes] = useState({});
  const [socket, setSocket] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const {
    data: elections = [],
    isLoading: isLoadingElections,
    error: electionsError,
  } = useGetElectionsQuery();

  const {
    data: candidatesData,
    isLoading: isLoadingCandidates,
    error: candidatesError,
  } = useGetCandidatesByElectionQuery(selectedElection?.id || 0, {
    skip: !selectedElection,
  });

  const [
    submitVotes,
    { isLoading: isSubmitting, error: submitError, isSuccess: submitSuccess },
  ] = useVoteMutation();

  // Initialize socket connection
  useEffect(() => {
    if (selectedElection) {
      const newSocket = io();
      setSocket(newSocket);

      newSocket.emit("joinElection", selectedElection.id);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [selectedElection]);

  // Initialize votes state when election is selected
  useEffect(() => {
    if (candidatesData && selectedElection) {
      const initialVotes = {};

      let portfolios = [];

      if (
        Array.isArray(candidatesData) &&
        candidatesData.length > 0 &&
        candidatesData[0].portfolios
      ) {
        portfolios = candidatesData[0].portfolios;
      } else if (candidatesData.portfolios) {
        portfolios = candidatesData.portfolios;
      } else if (Array.isArray(candidatesData)) {
        portfolios = candidatesData;
      }

      portfolios.forEach((portfolio) => {
        const portfolioId = portfolio.portfolioId || portfolio.id;
        initialVotes[portfolioId] = {
          candidateId: null,
          actionType: null,
        };
      });

      setVotes(initialVotes);
    }
  }, [candidatesData, selectedElection]);

  // Handle submission success/error with toast
  useEffect(() => {
    if (submitSuccess) {
      toast.success("Your votes have been recorded successfully!", {
        duration: 4000,
        icon: "🎉",
      });
      setShowConfirmModal(false);
    }
  }, [submitSuccess]);

  useEffect(() => {
    if (submitError) {
      toast.error(
        submitError.data?.error ||
          submitError.message ||
          "Failed to record votes. Please try again.",
        {
          duration: 4000,
        }
      );
      setShowConfirmModal(false);
    }
  }, [submitError]);

  // Handle election loading error with toast
  useEffect(() => {
    if (electionsError) {
      toast.error("Error loading elections. Please refresh the page.", {
        duration: 4000,
      });
    }
  }, [electionsError]);

  // Handle candidates loading error with toast
  useEffect(() => {
    if (candidatesError) {
      toast.error("Error loading candidates. Please try again.", {
        duration: 4000,
      });
    }
  }, [candidatesError]);

  const handleVoteChange = (portfolioId, candidateId, actionType = "VOTE") => {
    setVotes((prev) => ({
      ...prev,
      [portfolioId]: {
        candidateId: actionType === "VOTE" ? candidateId : null,
        actionType,
      },
    }));
  };

  const handleSubmitVotes = async () => {
    if (!selectedElection) {
      toast.error("Please select an election first");
      return;
    }

    // Check if all portfolios have a selection
    const portfolios = getPortfolios();
    const incompletePortfolios = portfolios.filter((portfolio) => {
      const portfolioId = portfolio.portfolioId || portfolio.id;
      return !votes[portfolioId]?.actionType;
    });

    if (incompletePortfolios.length > 0) {
      const portfolioNames = incompletePortfolios
        .map((p) => p.portfolioName || p.name)
        .join(", ");
      toast.error(`Please make a selection for: ${portfolioNames}`, {
        duration: 5000,
      });
      return;
    }

    try {
      const votesArray = Object.entries(votes).map(
        ([portfolioId, voteData]) => ({
          portfolioId: parseInt(portfolioId),
          candidateId: voteData.candidateId,
          actionType: voteData.actionType,
        })
      );

      await submitVotes({
        electionId: selectedElection.id,
        votes: votesArray,
      }).unwrap();
    } catch (error) {
      console.error("Error submitting votes:", error);
    }
  };

  const getPortfolios = () => {
    if (!candidatesData) return [];

    if (
      Array.isArray(candidatesData) &&
      candidatesData.length > 0 &&
      candidatesData[0].portfolios
    ) {
      return candidatesData[0].portfolios;
    }
    if (candidatesData.portfolios) {
      return candidatesData.portfolios;
    }
    if (Array.isArray(candidatesData)) {
      return candidatesData;
    }

    return [];
  };

  const getCandidateById = (candidateId) => {
    const portfolios = getPortfolios();

    for (const portfolio of portfolios) {
      const candidate = portfolio.candidates?.find((c) => c.id === candidateId);
      if (candidate) {
        return candidate;
      }
    }
    return null;
  };

  const getPortfolioById = (portfolioId) => {
    const portfolios = getPortfolios();
    return portfolios.find((p) => (p.portfolioId || p.id) === portfolioId);
  };

  const handleShowConfirmModal = () => {
    const portfolios = getPortfolios();
    const incompletePortfolios = portfolios.filter((portfolio) => {
      const portfolioId = portfolio.portfolioId || portfolio.id;
      return !votes[portfolioId]?.actionType;
    });

    if (incompletePortfolios.length > 0) {
      const portfolioNames = incompletePortfolios
        .map((p) => p.portfolioName || p.name)
        .join(", ");
      toast.error(`Please make a selection for: ${portfolioNames}`, {
        duration: 5000,
      });
      return;
    }

    setShowConfirmModal(true);
  };

  const handleCloseModal = () => {
    setShowConfirmModal(false);
  };

  const handleConfirmSubmit = () => {
    handleSubmitVotes();
  };

  if (isLoadingElections) {
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

  if (electionsError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex justify-center items-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="text-destructive mb-2">
              <Vote className="h-8 w-8 mx-auto mb-2" />
              <p className="font-medium">Election Loading Error</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Unable to load elections. Please refresh the page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const portfolios = getPortfolios();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Digital Voting System
          </h1>
          <p className="text-muted-foreground text-lg">
            Cast your vote securely and efficiently
          </p>
        </div>

        {/* Election Selection */}
        <Card className="mb-8 shadow-lg border-0 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Vote className="h-5 w-5 text-primary" />
              Select Election
            </CardTitle>
            <CardDescription>
              Choose an active election to participate in
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedElection?.id?.toString() || ""}
              onValueChange={(value) => {
                const election = elections.find(
                  (el) => el.id === parseInt(value)
                );
                setSelectedElection(election);
              }}
            >
              <SelectTrigger className="w-full h-12 text-base">
                <SelectValue placeholder="Choose an election" />
              </SelectTrigger>
              <SelectContent>
                {elections.map((election) => (
                  <SelectItem key={election.id} value={election.id.toString()}>
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
          </CardContent>
        </Card>

        {/* Voting Interface */}
        {selectedElection && (
          <div className="space-y-8">
            {/* Election Info */}
            <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-primary">
                  {selectedElection.name}
                </CardTitle>
                <CardDescription className="text-base">
                  {selectedElection.description}
                </CardDescription>
              </CardHeader>
            </Card>

            {isLoadingCandidates ? (
              <div className="flex justify-center items-center py-16">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">
                    Loading candidates...
                  </p>
                </div>
              </div>
            ) : (
              portfolios.map((portfolio) => {
                const portfolioId = portfolio.portfolioId || portfolio.id;
                const portfolioName = portfolio.portfolioName || portfolio.name;
                const candidates = portfolio.candidates || [];
                const currentVote = votes[portfolioId];
                const hasSelection = currentVote?.actionType;

                return (
                  <Card
                    key={portfolioId}
                    className={`shadow-lg border-0 bg-card/50 backdrop-blur-sm transition-all duration-300 ${
                      !hasSelection
                        ? "ring-2 ring-destructive/50 bg-destructive/5"
                        : "ring-2 ring-primary/20"
                    }`}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl">
                          {portfolioName}
                        </CardTitle>
                        {!hasSelection ? (
                          <Badge
                            variant="destructive"
                            className="animate-pulse"
                          >
                            Selection Required
                          </Badge>
                        ) : (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Selected
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Desktop Grid */}
                      <div className="hidden lg:grid grid-cols-4 xl:grid-cols-5 gap-4">
                        {candidates.map((candidate) => (
                          <CandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            isSelected={
                              currentVote?.candidateId === candidate.id
                            }
                            onClick={() =>
                              handleVoteChange(
                                portfolioId,
                                candidate.id,
                                "VOTE"
                              )
                            }
                          />
                        ))}
                        <SkipCard
                          isSelected={currentVote?.actionType === "SKIP"}
                          onClick={() =>
                            handleVoteChange(portfolioId, null, "SKIP")
                          }
                        />
                      </div>

                      {/* Tablet Grid */}
                      <div className="hidden md:grid lg:hidden grid-cols-3 gap-4">
                        {candidates.map((candidate) => (
                          <CandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            isSelected={
                              currentVote?.candidateId === candidate.id
                            }
                            onClick={() =>
                              handleVoteChange(
                                portfolioId,
                                candidate.id,
                                "VOTE"
                              )
                            }
                          />
                        ))}
                        <SkipCard
                          isSelected={currentVote?.actionType === "SKIP"}
                          onClick={() =>
                            handleVoteChange(portfolioId, null, "SKIP")
                          }
                        />
                      </div>

                      {/* Mobile List */}
                      <div className="grid md:hidden grid-cols-1 gap-3">
                        {candidates.map((candidate) => (
                          <CandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            isSelected={
                              currentVote?.candidateId === candidate.id
                            }
                            onClick={() =>
                              handleVoteChange(
                                portfolioId,
                                candidate.id,
                                "VOTE"
                              )
                            }
                            isMobile={true}
                          />
                        ))}
                        <SkipCard
                          isSelected={currentVote?.actionType === "SKIP"}
                          onClick={() =>
                            handleVoteChange(portfolioId, null, "SKIP")
                          }
                          isMobile={true}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}

            {/* Submit Button */}
            <div className="text-center pt-8">
              <Button
                onClick={handleShowConfirmModal}
                disabled={isSubmitting}
                size="lg"
                className="px-12 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting Votes...
                  </>
                ) : (
                  <>
                    <Vote className="mr-2 h-5 w-5" />
                    Submit All Votes
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-primary" />
                Confirm Your Votes
              </DialogTitle>
              <DialogDescription className="text-base">
                Please review your selections carefully before submitting:
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {Object.entries(votes).map(([portfolioId, voteData]) => {
                const portfolio = getPortfolioById(parseInt(portfolioId));
                if (!portfolio) return null;

                const portfolioName = portfolio.portfolioName || portfolio.name;

                return (
                  <Card key={portfolioId} className="bg-muted/30 border-0">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg text-primary">
                        {portfolioName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {voteData.actionType === "SKIP" ? (
                        <div className="flex items-center text-muted-foreground">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mr-3">
                            <SkipForward className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="font-medium">Skipped</p>
                            <p className="text-sm">
                              No vote cast for this portfolio
                            </p>
                          </div>
                        </div>
                      ) : voteData.candidateId ? (
                        <div className="flex items-center space-x-4">
                          {(() => {
                            const candidate = getCandidateById(
                              voteData.candidateId
                            );
                            if (!candidate) return null;

                            return (
                              <>
                                <Avatar className="w-12 h-12 ring-2 ring-primary/20">
                                  <AvatarImage
                                    src={candidate.profilePicture}
                                    alt={candidate.name}
                                  />
                                  <AvatarFallback>
                                    <User className="h-6 w-6" />
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold text-foreground">
                                    {candidate.name}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {candidate.party}
                                    {candidate.partySymbol &&
                                      ` (${candidate.partySymbol})`}
                                  </p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="text-muted-foreground italic">
                          No selection made
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={handleCloseModal}
                disabled={isSubmitting}
                size="lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                size="lg"
                className="min-w-[140px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Confirm & Submit
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

// Candidate Card Component
const CandidateCard = ({
  candidate,
  isSelected,
  onClick,
  isMobile = false,
}) => {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer transition-all duration-300 transform hover:scale-105 ${
        isMobile ? "p-4" : "p-6"
      } rounded-xl border-2 ${
        isSelected
          ? "border-primary bg-primary/10 shadow-lg ring-2 ring-primary/20"
          : "border-border hover:border-primary/50 bg-card/50 backdrop-blur-sm hover:bg-card/80"
      }`}
    >
      <div
        className={`flex ${
          isMobile
            ? "flex-row items-center space-x-4"
            : "flex-col items-center text-center"
        }`}
      >
        <Avatar
          className={`${
            isMobile ? "w-12 h-12" : "w-16 h-16 mb-3"
          } ring-2 ring-primary/20`}
        >
          <AvatarImage src={candidate.profilePicture} alt={candidate.name} />
          <AvatarFallback>
            <User className={`${isMobile ? "h-6 w-6" : "h-8 w-8"}`} />
          </AvatarFallback>
        </Avatar>
        <div className={`${isMobile ? "flex-1" : ""}`}>
          <h3
            className={`font-semibold text-foreground ${
              isMobile ? "text-base" : "text-sm mb-1"
            }`}
          >
            {candidate.name}
          </h3>
          <p
            className={`text-muted-foreground ${
              isMobile ? "text-sm" : "text-xs"
            }`}
          >
            {candidate.party}
            {candidate.partySymbol && ` (${candidate.partySymbol})`}
          </p>
        </div>
        {isSelected && (
          <div className={`${isMobile ? "" : "mt-2"}`}>
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Selected
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
};

// Skip Card Component
const SkipCard = ({ isSelected, onClick, isMobile = false }) => {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer transition-all duration-300 transform hover:scale-105 ${
        isMobile ? "p-4" : "p-6"
      } rounded-xl border-2 ${
        isSelected
          ? "border-primary bg-primary/10 shadow-lg ring-2 ring-primary/20"
          : "border-border hover:border-primary/50 bg-card/50 backdrop-blur-sm hover:bg-card/80"
      }`}
    >
      <div
        className={`flex ${
          isMobile
            ? "flex-row items-center space-x-4"
            : "flex-col items-center text-center"
        }`}
      >
        <div
          className={`${
            isMobile ? "w-12 h-12" : "w-16 h-16 mb-3"
          } rounded-full bg-muted flex items-center justify-center ring-2 ring-primary/20`}
        >
          <SkipForward
            className={`${
              isMobile ? "h-6 w-6" : "h-8 w-8"
            } text-muted-foreground`}
          />
        </div>
        <div className={`${isMobile ? "flex-1" : ""}`}>
          <h3
            className={`font-semibold text-muted-foreground ${
              isMobile ? "text-base" : "text-sm mb-1"
            }`}
          >
            Skip
          </h3>
          <p
            className={`text-muted-foreground ${
              isMobile ? "text-sm" : "text-xs"
            }`}
          >
            Skip this portfolio
          </p>
        </div>
        {isSelected && (
          <div className={`${isMobile ? "" : "mt-2"}`}>
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Selected
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
};

export default VotingInterface;
