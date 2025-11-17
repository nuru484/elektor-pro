"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useDeleteElectionMutation,
  useAuthUserQuery,
} from "@/redux/api/apiSlice";
import { Trash2, Edit, Eye, Calendar, MoreHorizontal } from "lucide-react";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { toast } from "react-hot-toast";
import { TableRow, TableCell } from "../ui/table";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export const ElectionListItem = ({ election }) => {
  const [deleteElection, { isLoading: isDeleting }] =
    useDeleteElectionMutation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const router = useRouter();
  const { data } = useAuthUserQuery();
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(data?.user?.role);

  const handleDelete = async () => {
    try {
      await deleteElection(election.id).unwrap();
      toast.success("Election deleted successfully");
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Failed to delete election:", error);
      toast.error(
        "Failed to delete election: " + (error.data?.error || "Unknown error")
      );
    }
  };

  const handleEdit = () => {
    router.push(`/dashboard/elections/${election.id}/edit`);
  };

  const handleViewDetails = () => {
    router.push(`/dashboard/elections/${election.id}/details`);
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case "IN_PROGRESS":
        return "success";
      case "ENDED":
        return "secondary";
      case "PAUSED":
        return "warning";
      case "CANCELLED":
        return "destructive";
      default:
        return "default";
    }
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
              aria-label={`Election name: ${election.name}`}
            >
              {election.name}
            </span>
            {election.description && (
              <span
                className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-xs"
                aria-label={`Election description: ${election.description}`}
              >
                {election.description}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="py-4 px-4 sm:px-6">
          <Badge
            variant={getStatusVariant(election.status)}
            className="text-xs font-semibold"
            aria-label={`Election status: ${election.status}`}
          >
            {election.status}
          </Badge>
        </TableCell>
        <TableCell className="py-4 px-4 sm:px-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <span aria-label={`Start date: ${formatDate(election.startDate)}`}>
              {formatDate(election.startDate)}
            </span>
          </div>
        </TableCell>
        <TableCell className="py-4 px-4 sm:px-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <span aria-label={`End date: ${formatDate(election.endDate)}`}>
              {formatDate(election.endDate)}
            </span>
          </div>
        </TableCell>
        <TableCell className="py-4 px-4 sm:px-6">
          {/* Desktop view - show individual buttons */}
          <div className="hidden sm:flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleViewDetails}
              aria-label={`View details of ${election.name}`}
              className="hover:bg-accent hover:text-accent-foreground"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleEdit}
                  aria-label={`Edit ${election.name}`}
                  className="hover:bg-accent hover:text-accent-foreground"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
                  aria-label={`Delete ${election.name}`}
                  className="hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          {/* Mobile view - show dropdown menu */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for ${election.name}`}
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
                {isAdmin && (
                  <>
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
          title="Delete Election"
          description={`Are you sure you want to delete "${election.name}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          confirmText="Delete"
          isDestructive
        />
      )}
    </>
  );
};
