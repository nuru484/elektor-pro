"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useDeletePortfolioMutation,
  useAuthUserQuery,
} from "@/redux/api/apiSlice";
import { Trash2, Edit, Eye, FileText, MoreHorizontal } from "lucide-react";
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

export const PortfolioListItem = ({ portfolio, electionName }) => {
  const [deletePortfolio, { isLoading: isDeleting }] =
    useDeletePortfolioMutation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const router = useRouter();
  const { data } = useAuthUserQuery();
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(data?.user?.role);

  const handleDelete = async () => {
    try {
      await deletePortfolio(portfolio.id).unwrap();
      toast.success("Portfolio deleted successfully");
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Failed to delete portfolio:", error);
      toast.error(
        "Failed to delete portfolio: " + (error.data?.error || "Unknown error")
      );
    }
  };

  const handleEdit = () => {
    router.push(`/dashboard/portfolios/${portfolio.id}/edit`);
  };

  const handleViewDetails = () => {
    router.push(`/dashboard/portfolios/${portfolio.id}/details`);
  };

  return (
    <>
      <TableRow className="group hover:bg-muted/30 transition-all duration-200 border-b border-border/30">
        <TableCell className="py-6 px-6 text-sm font-medium text-foreground">
          {portfolio.number}
        </TableCell>
        <TableCell className="py-6 px-6">
          <div className="flex flex-col gap-1.5">
            <span
              className="text-base font-semibold text-foreground"
              aria-label={`Portfolio name: ${portfolio.name}`}
            >
              {portfolio.name}
            </span>
            {portfolio.description && (
              <span
                className="text-sm text-muted-foreground truncate max-w-[250px] sm:max-w-md"
                aria-label={`Portfolio description: ${portfolio.description}`}
              >
                {portfolio.description}
              </span>
            )}
            <span
              className="text-sm text-muted-foreground"
              aria-label={`Election: ${electionName}`}
            >
              Election: {electionName}
            </span>
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
              aria-label={`View details of ${portfolio.name}`}
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
                  aria-label={`Edit ${portfolio.name}`}
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
                  aria-label={`Delete ${portfolio.name}`}
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
                  aria-label={`Actions for ${portfolio.name}`}
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
                      Edit Portfolio
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={isDeleting}
                      className="cursor-pointer hover:bg-red-50 hover:text-red-600لهdark:hover:bg-red-950 dark:hover:text-red-400 transition-colors duration-200 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4 mr-3" />
                      Delete Portfolio
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
          title="Delete Portfolio"
          description={`Are you sure you want to delete "${portfolio.name}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          confirmText="Delete"
          isDestructive
        />
      )}
    </>
  );
};
