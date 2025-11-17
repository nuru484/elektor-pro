"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCreateAdminMutation,
  useUpdateAdminMutation,
  useGetAdminQuery,
  useAuthUserQuery,
} from "@/redux/api/apiSlice";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, User, Save, Plus } from "lucide-react";
import * as z from "zod";

const adminFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters.").max(100),
  email: z.string().email("Invalid email address."),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters.")
    .optional()
    .or(z.literal("")),
  role: z.enum(["SUPER_ADMIN", "ADMIN"], {
    errorMap: () => ({ message: "Please select a valid role." }),
  }),
});

export function AdminForm({ adminId = null }) {
  const router = useRouter();
  const isEditMode = Boolean(adminId);

  const [createAdmin, { isLoading: isCreating }] = useCreateAdminMutation();
  const [updateAdmin, { isLoading: isUpdating }] = useUpdateAdminMutation();
  const {
    data: adminData,
    isLoading: isLoadingAdmin,
    error: adminError,
  } = useGetAdminQuery(adminId, { skip: !adminId });
  const { data: userData } = useAuthUserQuery();
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(userData?.user?.role);

  const isLoading = isCreating || isUpdating || isLoadingAdmin;

  const form = useForm({
    resolver: zodResolver(adminFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "",
    },
  });

  useEffect(() => {
    console.log("Admin Form Data:", adminData);
    if (adminData?.admin && isEditMode) {
      form.reset({
        name: adminData.admin.name || "",
        email: adminData.admin.email || "",
        password: "",
        role: adminData.admin.role || "",
      });
    }
  }, [adminData, isEditMode, form]);

  const onSubmit = async (values) => {
    if (!isAdmin) {
      toast.error("Unauthorized: Admin access required.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("name", values.name);
      formData.append("email", values.email);
      if (values.password) formData.append("password", values.password);
      formData.append("role", values.role);

      if (isEditMode) {
        await updateAdmin({ id: adminId, data: formData }).unwrap();
        toast.success("Admin updated successfully!");
      } else {
        await createAdmin(formData).unwrap();
        toast.success("Admin created successfully!");
        form.reset();
      }

      router.push("/dashboard/users");
    } catch (error) {
      const errorMessage =
        error?.data?.error ||
        `An unexpected error occurred while ${
          isEditMode ? "updating" : "creating"
        } the admin.`;
      toast.error(errorMessage);
    }
  };

  const handleBack = () => {
    router.back();
  };

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-muted-foreground">
          Unauthorized: Admin access required.
        </p>
      </div>
    );
  }

  if (isEditMode && isLoadingAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-6">Loading admin details...</div>
    );
  }

  if (isEditMode && adminError) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-muted-foreground">
          {adminError?.data?.error || "Failed to load admin data."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex items-center space-x-2 hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
          <div className="h-6 w-px bg-border"></div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditMode ? "Edit Admin" : "Create New Admin"}
          </h1>
        </div>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-muted/50 rounded-t-lg">
          <CardTitle className="flex items-center space-x-2">
            {isEditMode ? (
              <User className="h-5 w-5 text-primary" />
            ) : (
              <Plus className="h-5 w-5 text-primary" />
            )}
            <span>{isEditMode ? "Admin Details" : "New Admin Setup"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="space-y-6">
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <User className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-semibold">Admin Information</h3>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">
                          Name *
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., John Doe"
                            {...field}
                            className="h-11"
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the full name of the admin.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">
                          Email *
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="e.g., john.doe@example.com"
                            {...field}
                            className="h-11"
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the admin's email address.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">
                          Password {isEditMode ? "(Optional)" : "*"}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Enter password"
                            {...field}
                            className="h-11"
                          />
                        </FormControl>
                        <FormDescription>
                          {isEditMode
                            ? "Leave blank to keep the current password."
                            : "Enter a secure password (minimum 6 characters)."}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">
                          Role *
                        </FormLabel>
                        <Select
                          key={`role-${adminData?.admin?.id || "new"}-${
                            field.value
                          }`}
                          onValueChange={field.onChange}
                          value={field.value}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="SUPER_ADMIN">
                              Super Admin
                            </SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select the admin role (Super Admin or Admin).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-11 px-8 flex items-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>
                    {isLoading
                      ? isEditMode
                        ? "Updating..."
                        : "Creating..."
                      : isEditMode
                      ? "Update Admin"
                      : "Create Admin"}
                  </span>
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
