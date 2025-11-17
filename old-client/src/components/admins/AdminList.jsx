"use client";
import { useGetAdminsQuery, useAuthUserQuery } from "@/redux/api/apiSlice";
import { AdminListItem } from "./AdminListItem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { User, Plus, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const AdminList = () => {
  const { data, isLoading, error, refetch } = useGetAdminsQuery();
  const admins = data?.admins || [];
  const { data: userData } = useAuthUserQuery();
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(userData?.user?.role);
  const router = useRouter();

  const handleCreateAdmin = () => {
    router.push("/dashboard/users/new");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[20rem]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading admins...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[20rem] px-4">
        <Alert
          variant="destructive"
          className="max-w-md w-full border-0 shadow-lg"
        >
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
          <AlertTitle className="text-base">Something went wrong</AlertTitle>
          <AlertDescription className="flex flex-col gap-4">
            <span className="text-sm">
              {error.data?.error || "Failed to load admins."}
            </span>
            <Button
              onClick={refetch}
              variant="outline"
              size="sm"
              className="w-fit"
              aria-label="Retry loading admins"
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalAdmins = admins.length;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent rounded-2xl"></div>
        <div className="relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground tracking-tight">
                    Admin Management
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Manage system administrators
                  </p>
                </div>
              </div>
              {totalAdmins > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
                  <User className="h-4 w-4" />
                  <span className="font-medium text-foreground">
                    {totalAdmins}
                  </span>
                  <span>Total Admins</span>
                </div>
              )}
            </div>
            {isAdmin && (
              <Button
                onClick={handleCreateAdmin}
                className="w-fit bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
                size="lg"
                aria-label="Create new admin"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Admin
              </Button>
            )}
          </div>
        </div>
      </div>

      {!totalAdmins ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="text-center py-16">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl"></div>
                <div className="relative rounded-full bg-gradient-to-br from-primary/10 to-primary/20 p-6">
                  <User className="h-12 w-12 text-primary" aria-hidden="true" />
                </div>
              </div>
            </div>
            <h3 className="text-2xl font-semibold text-foreground mb-3">
              No admins yet
            </h3>
            <p className="text-muted-foreground text-base mb-8 max-w-md mx-auto leading-relaxed">
              Get started by creating your first admin user.
            </p>
            {isAdmin && (
              <Button
                onClick={handleCreateAdmin}
                size="lg"
                className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
                aria-label="Create your first admin"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Admin
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-muted/80 to-muted/40 border-b border-border/50 p-6">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-foreground">Admin List</h3>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="bg-card/50 rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border/50 bg-muted/30">
                    <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      #
                    </TableHead>
                    <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Admin
                    </TableHead>
                    <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Details
                    </TableHead>
                    <TableHead className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin, index) => (
                    <AdminListItem
                      key={admin.id}
                      admin={admin}
                      adminNumber={index + 1}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
