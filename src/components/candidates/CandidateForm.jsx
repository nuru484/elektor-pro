"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCreateCandidateMutation,
  useUpdateCandidateMutation,
  useGetCandidateQuery,
  useGetElectionsQuery,
  useGetPortfoliosByElectionQuery,
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
import { useEffect, useState } from "react";
import { ArrowLeft, User, FileText, Vote, Save, Plus } from "lucide-react";
import { candidatesFormSchema } from "@/validation/candidates-form-schema";

export default function CandidateForm({ candidateId = null }) {
  const router = useRouter();
  const isEditMode = Boolean(candidateId);

  // RTK Query hooks
  const [createCandidate, { isLoading: isCreating }] =
    useCreateCandidateMutation();

  const [updateCandidate, { isLoading: isUpdating }] =
    useUpdateCandidateMutation();

  const {
    data: candidateData,
    isLoading: isLoadingCandidate,
    error: candidateError,
  } = useGetCandidateQuery(candidateId, {
    skip: !candidateId,
  });

  const {
    data: elections = [],
    isLoading: isLoadingElections,
    error: electionsError,
  } = useGetElectionsQuery();

  const [selectedElectionId, setSelectedElectionId] = useState("");

  const {
    data: portfoliosData,
    isLoading: isLoadingPortfolios,
    error: portfoliosError,
  } = useGetPortfoliosByElectionQuery(selectedElectionId, {
    skip: !selectedElectionId,
  });

  const [previewImage, setPreviewImage] = useState(null);
  const isLoading = isCreating || isUpdating || isLoadingCandidate;

  // Initialize the form with react-hook-form and Zod resolver
  const form = useForm({
    resolver: zodResolver(candidatesFormSchema),
    defaultValues: {
      name: "",
      // party: "",
      // partySymbol: "",
      electionId: "",
      portfolioId: "",
      profilePicture: null,
    },
  });

  // Update form values and image preview when candidate data is loaded
  useEffect(() => {
    if (candidateData && isEditMode) {
      const updatedValues = {
        name: candidateData.name || "",
        // party: candidateData.party || "",
        // partySymbol: candidateData.partySymbol || "",
        electionId: String(candidateData.electionId) || "",
        portfolioId: String(candidateData.portfolioId) || "",
        profilePicture: null,
      };
      form.reset(updatedValues);
      setPreviewImage(candidateData.profilePicture || null);
      setSelectedElectionId(String(candidateData.electionId));
    }
  }, [candidateData, isEditMode, form]);

  // Handle form submission
  const onSubmit = async (values) => {
    try {
      const formData = new FormData();
      formData.append("name", values.name);
      // if (values.party) formData.append("party", values.party);
      // if (values.partySymbol)
      //   formData.append("partySymbol", values.partySymbol);
      formData.append("electionId", values.electionId);
      formData.append("portfolioId", values.portfolioId);
      if (values.profilePicture instanceof File) {
        formData.append("profilePicture", values.profilePicture);
      }

      if (isEditMode) {
        await updateCandidate({ id: candidateId, data: formData }).unwrap();
        toast.success("Candidate updated successfully!");
      } else {
        await createCandidate(formData).unwrap();
        toast.success("Candidate created successfully!");
        form.reset();
      }

      router.push("/dashboard/candidates");
    } catch (error) {
      const errorMessage =
        error?.data?.error ||
        error?.message ||
        `An unexpected error occurred while ${
          isEditMode ? "updating" : "creating"
        } the candidate.`;
      toast.error(errorMessage);
    }
  };

  // Handle image preview when a new file is selected
  const handleImageChange = (e, onChange) => {
    const file = e.target.files[0];
    onChange(file || null);
    if (file) {
      setPreviewImage(URL.createObjectURL(file));
    } else {
      setPreviewImage(candidateData?.profilePicture || null);
    }
  };

  const handleBack = () => {
    router.back();
  };

  // Handle loading and error states
  if (isEditMode && isLoadingCandidate) {
    return (
      <div className="max-w-4xl mx-auto p-6">Loading candidate details...</div>
    );
  }
  if (isEditMode && candidateError) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-muted-foreground">
          {candidateError?.data?.error || "Failed to load candidate data."}
        </p>
      </div>
    );
  }
  if (isLoadingElections) {
    return <div className="max-w-4xl mx-auto p-6">Loading elections...</div>;
  }

  if (electionsError) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-muted-foreground">
          {electionsError?.data?.error || "Failed to load elections data."}
        </p>
      </div>
    );
  }

  if (portfoliosError) {
    toast.error(portfoliosError?.data?.error || "Failed to load portfolios.");
  }

  const portfolios = portfoliosData?.portfolios || [];

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
            {isEditMode ? "Edit Candidate" : "Create New Candidate"}
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
            <span>
              {isEditMode ? "Candidate Details" : "New Candidate Setup"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="space-y-6">
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">
                          Candidate Name *
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., John Doe"
                            {...field}
                            className="h-11"
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the full name of the candidate.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* <FormField
                    control={form.control}
                    name="party"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">
                          Party
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Independent"
                            {...field}
                            className="h-11"
                          />
                        </FormControl>
                        <FormDescription>
                          Political party affiliation (optional).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  /> */}
                  {/* <FormField
                    control={form.control}
                    name="partySymbol"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">
                          Party Symbol
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Star"
                            {...field}
                            className="h-11"
                          />
                        </FormControl>
                        <FormDescription>
                          Symbol representing the party (optional).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  /> */}
                  <FormField
                    control={form.control}
                    name="profilePicture"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-medium">
                          Profile Picture
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              handleImageChange(e, field.onChange)
                            }
                            className="h-11"
                          />
                        </FormControl>
                        {previewImage && (
                          <div className="mt-2">
                            <img
                              src={previewImage}
                              alt="Profile Preview"
                              className="h-32 w-32 object-cover rounded-md"
                            />
                          </div>
                        )}
                        <FormDescription>
                          {previewImage
                            ? "Current profile picture. Upload a new one to replace it."
                            : "Upload a profile picture for the candidate (optional)."}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <Vote className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-semibold">
                    Election and Portfolio
                  </h3>
                </div>

                <FormField
                  control={form.control}
                  name="electionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">
                        Election *
                      </FormLabel>
                      <Select
                        key={`election-${candidateData?.id || "new"}-${
                          field.value
                        }`}
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedElectionId(value);
                          form.setValue("portfolioId", "");
                        }}
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
                        Select the election the candidate is running in.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="portfolioId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">
                        Portfolio *
                      </FormLabel>
                      <Select
                        key={`portfolio-${candidateData?.id || "new"}-${
                          field.value
                        }`}
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue={field.value}
                        disabled={
                          !selectedElectionId ||
                          portfolios.length === 0 ||
                          isLoadingPortfolios
                        }
                      >
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select a portfolio" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {portfolios.map((portfolio) => (
                            <SelectItem
                              key={portfolio.id}
                              value={String(portfolio.id)}
                            >
                              {portfolio.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the portfolio the candidate is contesting for.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end pt-6 border-t">
                <Button
                  type="submit"
                  disabled={isLoading || isLoadingPortfolios}
                  className="h-11 px-8 flex items-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>
                    {isLoading
                      ? isEditMode
                        ? "Updating..."
                        : "Creating..."
                      : isEditMode
                      ? "Update Candidate"
                      : "Create Candidate"}
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
