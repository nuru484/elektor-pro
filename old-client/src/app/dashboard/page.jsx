// src/app/dashboard/voter/page.jsx
"use client";
import { VoterDashboard } from "@/components/dashboards/VoterDashboard";
import { AdminDashboard } from "@/components/dashboards/AdminDashboard";
import { useAuthUserQuery } from "@/redux/api/apiSlice";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { data: userData, isLoading } = useAuthUserQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[20rem]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading user data...</p>
        </div>
      </div>
    );
  }

  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(userData?.user?.role);

  return (
    <div className="container mx-auto">
      {isAdmin ? <AdminDashboard /> : <VoterDashboard />}
    </div>
  );
}
