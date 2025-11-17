// src/components/ElectionForm.jsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCreateElectionMutation,
  useUpdateElectionMutation,
  useGetElectionQuery,
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
import { Textarea } from "@/components/ui/textarea";
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
import {
  ArrowLeft,
  Calendar,
  FileText,
  Settings,
  Save,
  Plus,
} from "lucide-react";
import { electionFormSchema } from "@/validation/election-form-schema";

export default function ElectionForm({ electionId = null }) {
  const router = useRouter();
  const isEditMode = Boolean(electionId);

  // RTK Query hooks
  const [createElection, { isLoading: isCreating }] =
    useCreateElectionMutation();

  const [updateElection, { isLoading: isUpdating }] =
    useUpdateElectionMutation();

  const {
    data: electionData,
    isLoading: isLoadingElection,
    error: electionError,
  } = useGetElectionQuery(electionId, {
    skip: !electionId,
  });

  const isLoading = isCreating || isUpdating || isLoadingElection;

  // Initialize the form with react-hook-form and Zod resolver
  const form = useForm({
    resolver: zodResolver(electionFormSchema),
    defaultValues: {
      name: "",
      description: "",
      startDate: "",
      endDate: "",
      status: "UPCOMING",
    },
  });

  // Update form values when election data is loaded
  useEffect(() => {
    if (electionData && isEditMode) {
      form.reset({
        name: electionData.name || "",
        description: electionData.description || "",
        startDate: electionData.startDate
          ? new Date(electionData.startDate).toISOString().slice(0, 16)
          : "",
        endDate: electionData.endDate
          ? new Date(electionData.endDate).toISOString().slice(0, 16)
          : "",
        status: electionData.status || "UPCOMING",
      });
    }
  }, [electionData, isEditMode, form]);

  // Handle form submission
  const onSubmit = async (values) => {
    try {
      const payload = {
        name: values.name,
        description: values.description || undefined,
        startDate: values.startDate
          ? new Date(values.startDate).toISOString()
          : undefined,
        endDate: values.endDate
          ? new Date(values.endDate).toISOString()
          : undefined,
        status: values.status,
      };

      if (isEditMode) {
        await updateElection({ id: electionId, ...payload }).unwrap();
        toast.success("Election updated successfully!");
      } else {
        await createElection(payload).unwrap();
        toast.success("Election created successfully!");
        form.reset();
      }

      router.push("/dashboard/elections");
    } catch (error) {
      const errorMessage =
        error?.data?.error ||
        error?.message ||
        `An unexpected error occurred while ${
          isEditMode ? "updating" : "creating"
        } the election.`;
      toast.error(errorMessage);
    }
  };

  const handleBack = () => {
    router.back();
  };

  // Handle loading state for edit mode
  if (isEditMode && isLoadingElection) {
    return (
      <div className="max-w-4xl mx-auto p-6">Loading election details...</div>
    );
  }

  // Handle error state for edit mode
  if (isEditMode && electionError) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-muted-foreground">
          {electionError?.data?.error || "Failed to load election data."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header with back button */}
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
            {isEditMode ? "Edit Election" : "Create New Election"}
          </h1>
        </div>
      </div>

      {/* Main form card */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-muted/50 rounded-t-lg">
          <CardTitle className="flex items-center space-x-2">
            {isEditMode ? (
              <Settings className="h-5 w-5 text-primary" />
            ) : (
              <Plus className="h-5 w-5 text-primary" />
            )}
            <span>
              {isEditMode ? "Election Details" : "New Election Setup"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Basic Information Section */}
              <div className="space-y-6">
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {/* Name Field */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">
                          Election Name *
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., General Election 2025"
                            {...field}
                            className="h-11"
                          />
                        </FormControl>
                        <FormDescription>
                          Enter a unique and descriptive name for the election.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Description Field */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">
                          Description
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., Annual election for leadership roles and key positions"
                            {...field}
                            className="min-h-[100px] resize-none"
                          />
                        </FormControl>
                        <FormDescription>
                          Provide a brief description of the election purpose
                          and scope (optional).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Schedule Section */}
              <div className="space-y-6">
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-semibold">Schedule</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Start Date Field */}
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">
                          Start Date & Time
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                            className="h-11"
                            value={field.value || ""}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          When voting should begin (optional, defaults to now).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* End Date Field */}
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">
                          End Date & Time
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                            className="h-11"
                            value={field.value || ""}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          When voting should end (optional, defaults to 7 days
                          from start).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Status Section */}
              <div className="space-y-6">
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <Settings className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-semibold">Status</h3>
                </div>

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">
                        Election Status
                      </FormLabel>
                      <Select
                        key={`status-${electionData?.id || "new"}-${
                          field.value
                        }`}
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select a status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="UPCOMING">Upcoming</SelectItem>
                          <SelectItem value="IN_PROGRESS">
                            In Progress
                          </SelectItem>
                          <SelectItem value="ENDED">Ended</SelectItem>
                          <SelectItem value="PAUSED">Paused</SelectItem>
                          <SelectItem value="CANCELLED">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Set the current status of the election.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Submit Button */}
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
                      ? "Update Election"
                      : "Create Election"}
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
