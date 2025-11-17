"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCreatePortfolioMutation,
  useUpdatePortfolioMutation,
  useGetPortfolioQuery,
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
import { ArrowLeft, FileText, Vote, Save, Plus } from "lucide-react";
import { portfolioFormSchema } from "@/validation/portfolio-form-schema";

export default function PortfolioForm({ portfolioId = null }) {
  const router = useRouter();
  const isEditMode = Boolean(portfolioId);

  // RTK Query hooks
  const [createPortfolio, { isLoading: isCreating }] =
    useCreatePortfolioMutation();
  const [updatePortfolio, { isLoading: isUpdating }] =
    useUpdatePortfolioMutation();
  const {
    data: portfolioData,
    isLoading: isLoadingPortfolio,
    error: portfolioError,
  } = useGetPortfolioQuery(portfolioId, {
    skip: !portfolioId,
  });

  const {
    data: elections = [],
    isLoading: isLoadingElections,
    error: electionsError,
  } = useGetElectionsQuery();

  const isLoading = isCreating || isUpdating || isLoadingPortfolio;

  // Initialize the form with react-hook-form and Zod resolver
  const form = useForm({
    resolver: zodResolver(portfolioFormSchema),
    defaultValues: {
      name: "",
      description: "",
      electionId: "",
    },
  });

  // Update form values when portfolio data is loaded
  useEffect(() => {
    if (portfolioData && isEditMode) {
      form.reset({
        name: portfolioData.name || "",
        description: portfolioData.description || "",
        electionId: portfolioData.electionId
          ? String(portfolioData.electionId)
          : "",
      });
    }
  }, [portfolioData, isEditMode, form]);

  // Handle form submission
  const onSubmit = async (values) => {
    try {
      const payload = {
        name: values.name,
        description: values.description || undefined,
        electionId: parseInt(values.electionId),
      };

      if (isEditMode) {
        await updatePortfolio({ id: portfolioId, ...payload }).unwrap();
        toast.success("Portfolio updated successfully!");
      } else {
        await createPortfolio(payload).unwrap();
        toast.success("Portfolio created successfully!");
        form.reset();
      }

      router.push("/dashboard/portfolios");
    } catch (error) {
      const errorMessage =
        error?.data?.error ||
        error?.message ||
        `An unexpected error occurred while ${
          isEditMode ? "updating" : "creating"
        } the portfolio.`;
      toast.error(errorMessage);
    }
  };

  const handleBack = () => {
    router.back();
  };

  // Handle loading state for edit mode
  if (isEditMode && isLoadingPortfolio) {
    return (
      <div className="max-w-4xl mx-auto p-6">Loading portfolio details...</div>
    );
  }

  // Handle error state for edit mode
  if (isEditMode && portfolioError) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-muted-foreground">
          {portfolioError?.data?.error || "Failed to load portfolio data."}
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
            {isEditMode ? "Edit Portfolio" : "Create New Portfolio"}
          </h1>
        </div>
      </div>

      {/* Main form card */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-muted/50 rounded-t-lg">
          <CardTitle className="flex items-center space-x-2">
            {isEditMode ? (
              <FileText className="h-5 w-5 text-primary" />
            ) : (
              <Plus className="h-5 w-5 text-primary" />
            )}
            <span>
              {isEditMode ? "Portfolio Details" : "New Portfolio Setup"}
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
                          Portfolio Name *
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., President"
                            {...field}
                            className="h-11"
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the name of the portfolio.
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
                            placeholder="e.g., Responsibilities include leading the organization..."
                            {...field}
                            className="h-24"
                          />
                        </FormControl>
                        <FormDescription>
                          Provide a description of the portfolio (optional).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Election Section */}
              <div className="space-y-6">
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <Vote className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-semibold">Election</h3>
                </div>

                {/* Election Field */}
                <FormField
                  control={form.control}
                  name="electionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">
                        Election *
                      </FormLabel>
                      <Select
                        key={`election-${portfolioData?.id || "new"}-${
                          field.value
                        }`}
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select an election" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {elections.map((election) => (
                            <SelectItem
                              key={election.id}
                              value={String(election.id)}
                            >
                              {election.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the election this portfolio is associated with.
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
                      ? "Update Portfolio"
                      : "Create Portfolio"}
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
