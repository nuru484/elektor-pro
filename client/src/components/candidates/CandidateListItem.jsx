"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useDeleteCandidateMutation,
  useAuthUserQuery,
} from "@/redux/api/apiSlice";
import { Trash2, Edit, Eye, User, MoreHorizontal, Flag } from "lucide-react";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { toast } from "react-hot-toast";
import { TableRow, TableCell } from "../ui/table";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export const CandidateListItem = ({
  candidate,
  candidateNumber,
  electionName,
}) => {
  const [deleteCandidate, { isLoading: isDeleting }] =
    useDeleteCandidateMutation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const router = useRouter();
  const { data } = useAuthUserQuery();
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(data?.user?.role);

  const handleDelete = async () => {
    try {
      await deleteCandidate(candidate.id).unwrap();
      toast.success("Candidate deleted successfully");
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Failed to delete candidate:", error);
      toast.error(
        "Failed to delete candidate: " + (error.data?.error || "Unknown error")
      );
    }
  };

  const handleEdit = () => {
    router.push(`/dashboard/candidates/${candidate.id}/edit`);
  };

  const handleViewDetails = () => {
    router.push(`/dashboard/candidates/${candidate.id}/details`);
  };

  // Helper function to get initials from name
  const getInitials = (name) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <TableRow className="group hover:bg-muted/30 transition-all duration-200 border-b border-border/30">
        <TableCell className="py-6 px-6 text-sm font-medium text-foreground">
          {candidateNumber}
        </TableCell>
        <TableCell className="py-6 px-6">
          <div className="flex items-center gap-4">
            {/* Enhanced Profile Picture or Avatar */}
            <div className="relative">
              {candidate.profilePicture ? (
                <Avatar className="h-12 w-12 flex-shrink-0 border-2 border-border/50 shadow-sm">
                  <AvatarImage
                    src={candidate.profilePicture}
                    alt={`${candidate.name} profile picture`}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-primary/10 to-primary/20 text-primary font-semibold text-sm">
                    {getInitials(candidate.name)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center border-2 border-border/50 shadow-sm">
                  <span className="text-primary font-semibold text-sm">
                    {getInitials(candidate.name)}
                  </span>
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full border-2 border-background shadow-sm"></div>
            </div>

            {/* Enhanced Candidate Info */}
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-foreground truncate">
                  {candidate.name}
                </span>
                {candidate.isVerified && (
                  <div className="h-4 w-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg
                      className="h-2.5 w-2.5 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
              {candidate.party && (
                <div className="flex items-center gap-2">
                  <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground truncate max-w-[250px]">
                    {candidate.party}
                  </span>
                </div>
              )}
            </div>
          </div>
        </TableCell>

        <TableCell className="py-6 px-6">
          <div className="flex items-center gap-3">
            {candidate.partySymbol && (
              <Badge
                variant="secondary"
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-muted/80 to-muted/60 text-muted-foreground font-medium border border-border/50"
              >
                <span className="text-xs">Symbol:</span>
                <span className="ml-1 font-semibold">
                  {candidate.partySymbol}
                </span>
              </Badge>
            )}
            {candidate.position && (
              <Badge
                variant="outline"
                className="px-3 py-1.5 rounded-full bg-primary/5 text-primary border-primary/20 font-medium"
              >
                {candidate.position}
              </Badge>
            )}
          </div>
        </TableCell>

        <TableCell className="py-6 px-6">
          {/* Desktop view - enhanced individual buttons */}
          <div className="hidden sm:flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewDetails}
              className="hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400 transition-colors duration-200 group-hover:shadow-sm"
              aria-label={`View details of ${candidate.name}`}
            >
              <Eye className="h-4 w-4 mr-1.5" />
              <span className="text-xs font-medium">View</span>
            </Button>
            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  className="hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950 dark:hover:text-amber-400 transition-colors duration-200 group-hover:shadow-sm"
                  aria-label={`Edit ${candidate.name}`}
                >
                  <Edit className="h-4 w-4 mr-1.5" />
                  <span className="text-xs font-medium">Edit</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
                  className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400 transition-colors duration-200 group-hover:shadow-sm disabled:opacity-50"
                  aria-label={`Delete ${candidate.name}`}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  <span className="text-xs font-medium">Delete</span>
                </Button>
              </>
            )}
          </div>

          {/* Mobile view - enhanced dropdown menu */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:bg-muted/60 hover:text-foreground transition-colors duration-200 group-hover:shadow-sm"
                  aria-label={`Actions for ${candidate.name}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 shadow-lg border border-border/50"
              >
                <DropdownMenuItem
                  onClick={handleViewDetails}
                  className="cursor-pointer hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400 transition-colors duration-200"
                >
                  <Eye className="h-4 w-4 mr-3" />
                  View Details
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuItem
                      onClick={handleEdit}
                      className="cursor-pointer hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950 dark:hover:text-amber-400 transition-colors duration-200"
                    >
                      <Edit className="h-4 w-4 mr-3" />
                      Edit Candidate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={isDeleting}
                      className="cursor-pointer hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400 transition-colors duration-200 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4 mr-3" />
                      Delete Candidate
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      {isAdmin && (
        <ConfirmationDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Delete Candidate"
          description={`Are you sure you want to delete "${candidate.name}"? This action cannot be undone and will remove all associated data.`}
          onConfirm={handleDelete}
          confirmText="Delete Candidate"
          isDestructive
        />
      )}
    </>
  );
};
