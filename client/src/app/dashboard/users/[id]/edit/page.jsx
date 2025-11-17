// src/app/dashboard/users/[id]/edit/page.jsx
"use client";
import { useParams } from "next/navigation";
import { AdminForm } from "@/components/admins/AdminForm";

export default function UpdateAdminPage() {
  const { id } = useParams();

  return (
    <div className="container mx-auto">
      <AdminForm adminId={id} />
    </div>
  );
}
