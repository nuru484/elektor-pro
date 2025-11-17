// src/components/admins/AdminListItem.jsx
"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useDeleteAdminMutation, useAuthUserQuery } from "@/redux/api/apiSlice";
import { Trash2, Edit, Eye, User, MoreHorizontal } from "lucide-react";
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

export const AdminListItem = ({ admin, adminNumber }) => {
  const [deleteAdmin, { isLoading: isDeleting }] = useDeleteAdminMutation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const router = useRouter();
  const { data } = useAuthUserQuery();
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(data?.user?.role);

  const handleDelete = async () => {
    try {
      await deleteAdmin(admin.id).unwrap();
      toast.success("Admin deleted successfully");
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Failed to delete admin:", error);
      toast.error(
        "Failed to delete admin: " + (error.data?.error || "Unknown error")
      );
    }
  };

  const handleEdit = () => {
    router.push(`/dashboard/users/${admin.id}/edit`);
  };

  const handleViewDetails = () => {
    router.push(`/dashboard/users/${admin.id}/details`);
  };

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
          {adminNumber}
        </TableCell>
        <TableCell className="py-6 px-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-12 w-12 flex-shrink-0 border-2 border-border/50 shadow-sm">
                <AvatarImage
                  src={admin.profilePicture || ""}
                  alt={`${admin.name} profile picture`}
                  className="object-cover"
                />
                <AvatarFallback className="bg-gradient-to-br from-primary/10 to-primary/20 text-primary font-semibold text-sm">
                  {getInitials(admin.name)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full border-2 border-background shadow-sm"></div>
            </div>
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
              <span className="text-base font-semibold text-foreground truncate">
                {admin.name}
              </span>
              <span className="text-sm text-muted-foreground truncate max-w-[250px]">
                {admin.email}
              </span>
            </div>
          </div>
        </TableCell>
        <TableCell className="py-6 px-6">
          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className="px-3 py-1.5 rounded-full bg-gradient-to-r from-muted/80 to-muted/60 text-muted-foreground font-medium border border-border/50"
            >
              {admin.role}
            </Badge>
          </div>
        </TableCell>
        <TableCell className="py-6 px-6">
          <div className="hidden sm:flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewDetails}
              className="hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400 transition-colors duration-200 group-hover:shadow-sm"
              aria-label={`View details of ${admin.name}`}
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
                  aria-label={`Edit ${admin.name}`}
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
                  aria-label={`Delete ${admin.name}`}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  <span className="text-xs font-medium">Delete</span>
                </Button>
              </>
            )}
          </div>
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:bg-muted/60 hover:text-foreground transition-colors duration-200 group-hover:shadow-sm"
                  aria-label={`Actions for ${admin.name}`}
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
                      Edit Admin
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={isDeleting}
                      className="cursor-pointer hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400 transition-colors duration-200 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4 mr-3" />
                      Delete Admin
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
          title="Delete Admin"
          description={`Are you sure you want to delete "${admin.name}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          confirmText="Delete Admin"
          isDestructive
        />
      )}
    </>
  );
};
