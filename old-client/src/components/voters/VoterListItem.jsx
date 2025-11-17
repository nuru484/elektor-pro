"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useDeleteVoterMutation } from "@/redux/api/apiSlice";
import { Trash2, Edit, Eye, MoreHorizontal } from "lucide-react";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { toast } from "react-hot-toast";
import { TableRow, TableCell } from "../ui/table";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export const VoterListItem = ({ voter, electionName }) => {
  const [deleteVoter, { isLoading: isDeleting }] = useDeleteVoterMutation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    try {
      await deleteVoter(voter.id).unwrap();
      toast.success("Voter deleted successfully");
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Failed to delete voter:", error);
      toast.error(
        "Failed to delete voter: " + (error.data?.error || "Unknown error")
      );
    }
  };

  const handleEdit = () => {
    router.push(`/dashboard/voters/${voter.id}/edit`);
  };

  const handleViewDetails = () => {
    router.push(`/dashboard/voters/${voter.id}/details`);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <TableRow className="hover:bg-muted/50 transition-colors">
        <TableCell className="py-4 px-4 sm:px-6">
          <div className="flex flex-col gap-1">
            <span
              className="text-sm font-medium text-foreground"
              aria-label={`Voter name: ${voter.name}`}
            >
              {voter.name}
            </span>
            <span
              className="text-sm text-muted-foreground"
              aria-label={`Election: ${electionName}`}
            >
              Election: {electionName}
            </span>
          </div>
        </TableCell>
        <TableCell className="py-4 px-4 sm:px-6 text-sm text-muted-foreground">
          <span aria-label={`Voter ID: ${voter.voterId || "N/A"}`}>
            {voter.voterId || "N/A"}
          </span>
        </TableCell>
        <TableCell className="py-4 px-4 sm:px-6 text-sm text-muted-foreground">
          <span aria-label={`Phone: ${voter.phoneNumber || "N/A"}`}>
            {voter.phoneNumber || "N/A"}
          </span>
        </TableCell>
        <TableCell className="py-4 px-4 sm:px-6 text-sm text-muted-foreground">
          <span aria-label={`Created: ${formatDate(voter.createdAt)}`}>
            {formatDate(voter.createdAt)}
          </span>
        </TableCell>
        <TableCell className="py-4 px-4 sm:px-6">
          {/* Desktop view - show individual buttons */}
          <div className="hidden sm:flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleViewDetails}
              aria-label={`View details of ${voter.name}`}
              className="hover:bg-accent hover:text-accent-foreground"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleEdit}
              aria-label={`Edit ${voter.name}`}
              className="hover:bg-accent hover:text-accent-foreground"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
              aria-label={`Delete ${voter.name}`}
              className="hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile view - show dropdown menu */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for ${voter.name}`}
                  className="hover:bg-accent hover:text-accent-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={handleViewDetails}
                  className="cursor-pointer"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleEdit}
                  className="cursor-pointer"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Voter"
        description={`Are you sure you want to delete "${voter.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        confirmText="Delete"
        isDestructive
      />
    </>
  );
};
