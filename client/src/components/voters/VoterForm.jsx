"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCreateVoterMutation,
  useUpdateVoterMutation,
  useGetVoterQuery,
  useGetElectionsQuery,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, User, FileText, Vote, Save, Plus } from "lucide-react";
import { votersFormSchema } from "@/validation/voters-form-schema";

export default function VoterForm({ voterId = null }) {
  const router = useRouter();
  const isEditMode = Boolean(voterId);

  // RTK Query hooks
  const [createVoter, { isLoading: isCreating }] = useCreateVoterMutation();
  const [updateVoter, { isLoading: isUpdating }] = useUpdateVoterMutation();
  const {
    data: voterData,
    isLoading: isLoadingVoter,
    error: voterError,
  } = useGetVoterQuery(voterId, {
    skip: !voterId,
  });
  const {
    data: elections = [],
    isLoading: isLoadingElections,
    error: electionsError,
  } = useGetElectionsQuery();

  const isLoading = isCreating || isUpdating || isLoadingVoter;

  // Initialize the form with react-hook-form and Zod resolver
  const form = useForm({
    resolver: zodResolver(votersFormSchema),
    defaultValues: {
      name: "",
      voterId: "",
      phoneNumber: "",
      profilePicture: "",
      electionIds: [],
    },
  });

  // Update form values when voter data and elections are loaded
  useEffect(() => {
    if (voterData && isEditMode && elections.length > 0) {
      const voterElectionIds = voterData.elections.map((e) => String(e.id));
      const validElectionIds = voterElectionIds.filter((id) =>
        elections.some((election) => String(election.id) === id)
      );

      if (validElectionIds.length === 0 && voterData.elections.length > 0) {
        console.warn(
          `No valid elections found for voter with ID ${voterId}. Available election IDs:`,
          elections.map((e) => e.id)
        );
        toast.error("No valid elections are available for this voter.");
      }

      form.reset({
        name: voterData.name || "",
        voterId: voterData.voterId || "",
        phoneNumber: voterData.phoneNumber || "",
        profilePicture: voterData.profilePicture || "",
        electionIds: validElectionIds,
      });
    }
  }, [voterData, isEditMode, elections, form, voterId]);

  // Handle form submission
  const onSubmit = async (values) => {
    try {
      const payload = {
        name: values.name,
        voterId: values.voterId,
        phoneNumber: values.phoneNumber,
        profilePicture: values.profilePicture || undefined,
        electionIds: values.electionIds.map((id) => parseInt(id)),
      };

      console.log("Payload: ", payload);

      if (isEditMode) {
        await updateVoter({ id: voterId, ...payload }).unwrap();
        toast.success("Voter updated successfully!");
      } else {
        await createVoter(payload).unwrap();
        toast.success("Voter created successfully!");
        form.reset();
      }

      router.push("/dashboard/voters");
    } catch (error) {
      const errorMessage =
        error?.data?.error ||
        error?.message ||
        `An unexpected error occurred while ${
          isEditMode ? "updating" : "creating"
        } the voter.`;
      toast.error(errorMessage);
    }
  };

  const handleBack = () => {
    router.back();
  };

  // Handle loading state for edit mode
  if (isEditMode && isLoadingVoter) {
    return (
      <div className="max-w-4xl mx-auto p-6">Loading voter details...</div>
    );
  }

  // Handle error state for edit mode
  if (isEditMode && voterError) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-muted-foreground">
          {voterError?.data?.error || "Failed to load voter data."}
        </p>
      </div>
    );
  }

  // Handle loading state for elections
  if (isLoadingElections) {
    return <div className="max-w-4xl mx-auto p-6">Loading elections...</div>;
  }

  // Handle error state for elections
  if (electionsError) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-muted-foreground">
          {electionsError?.data?.error || "Failed to load elections data."}
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
            {isEditMode ? "Edit Voter" : "Create New Voter"}
          </h1>
        </div>
      </div>

      {/* Main form card */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-muted/50 rounded-t-lg">
          <CardTitle className="flex items-center space-x-2">
            {isEditMode ? (
              <User className="h-5 w-5 text-primary" />
            ) : (
              <Plus className="h-5 w-5 text-primary" />
            )}
            <span>{isEditMode ? "Voter Details" : "New Voter Setup"}</span>
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
                          Voter Name *
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., John Doe"
                            {...field}
                            className="h-11"
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the full name of the voter.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Voter ID Field */}
                  <FormField
                    control={form.control}
                    name="voterId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">
                          Voter ID *
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., VOT123456"
                            {...field}
                            className="h-11"
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the unique identifier for the voter.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Phone Number Field */}
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">
                          Phone Number *
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., +1234567890"
                            {...field}
                            className="h-11"
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the voter's phone number in international
                          format.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Profile Picture Field */}
                  <FormField
                    control={form.control}
                    name="profilePicture"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">
                          Profile Picture URL
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., https://example.com/profile.jpg"
                            {...field}
                            className="h-11"
                          />
                        </FormControl>
                        <FormDescription>
                          URL to the voter's profile picture (optional).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Elections Section */}
              <div className="space-y-6">
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <Vote className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-semibold">Elections</h3>
                </div>

                <FormField
                  control={form.control}
                  name="electionIds"
                  render={({ field }) => {
                    console.log("Current electionIds value:", field.value);
                    console.log(
                      "Available election IDs:",
                      elections.map((e) => String(e.id))
                    );
                    return (
                      <FormItem>
                        <FormLabel className="text-base font-medium">
                          Elections *
                        </FormLabel>
                        <div className="space-y-2">
                          {elections.map((election) => (
                            <div
                              key={election.id}
                              className="flex items-center space-x-2"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value.includes(
                                    String(election.id)
                                  )}
                                  onCheckedChange={(checked) => {
                                    const updatedValue = checked
                                      ? [...field.value, String(election.id)]
                                      : field.value.filter(
                                          (id) => id !== String(election.id)
                                        );
                                    field.onChange(updatedValue);
                                  }}
                                />
                              </FormControl>
                              <label className="text-sm font-medium">
                                {election.name}
                              </label>
                            </div>
                          ))}
                        </div>
                        <FormDescription>
                          Select the election(s) this voter is associated with.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
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
                      ? "Update Voter"
                      : "Create Voter"}
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
