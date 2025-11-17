"use client";
import { useState } from "react";
import {
  useUploadVotersMutation,
  useGetElectionsQuery,
} from "@/redux/api/apiSlice";
import { Upload, AlertCircle, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const VoterUpload = ({ open, onOpenChange }) => {
  const [file, setFile] = useState(null);
  const [electionId, setElectionId] = useState("");
  const [errorDetails, setErrorDetails] = useState([]);
  const [uploadVoters, { isLoading: isUploading }] = useUploadVotersMutation();
  const {
    data: elections = [],
    isLoading: isElectionsLoading,
    error: electionsError,
  } = useGetElectionsQuery();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setErrorDetails([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !electionId) {
      toast.error("Please select an election and upload an Excel file.");
      setErrorDetails([]);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("electionId", electionId);

    try {
      const response = await uploadVoters(formData).unwrap();
      toast.success(response.message);
      setFile(null);
      setElectionId("");
      setErrorDetails([]);
      e.target.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to upload voters:", error);
      if (error.data?.details) {
        setErrorDetails(error.data.details);
        toast.error("Validation errors occurred. See details below.");
      } else {
        setErrorDetails([]);
        toast.error(error.data?.error || "Failed to upload voters.");
      }
    }
  };

  // Categorize errors for display
  const nameErrors = errorDetails.filter(
    (err) => err.includes("name") || err.includes("Missing required field")
  );
  const phoneErrors = errorDetails.filter(
    (err) => err.includes("phone number") || err.includes("phoneNumber")
  );
  const voterIdErrors = errorDetails.filter(
    (err) => err.includes("voterId") || err.includes("Voter ID")
  );
  const otherErrors = errorDetails.filter(
    (err) =>
      !nameErrors.includes(err) &&
      !phoneErrors.includes(err) &&
      !voterIdErrors.includes(err)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload Voters</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="electionId" className="text-sm font-medium">
              Select Election
            </Label>
            {isElectionsLoading ? (
              <div className="text-muted-foreground">Loading elections...</div>
            ) : electionsError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  Failed to load elections:{" "}
                  {electionsError.data?.error || "Unknown error"}
                </AlertDescription>
              </Alert>
            ) : elections.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Elections</AlertTitle>
                <AlertDescription>
                  No elections available. Please create an election first.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={electionId} onValueChange={setElectionId} required>
                <SelectTrigger id="electionId" aria-label="Select election">
                  <SelectValue placeholder="Select an election" />
                </SelectTrigger>
                <SelectContent>
                  {elections.map((election) => (
                    <SelectItem
                      key={election.id}
                      value={election.id.toString()}
                    >
                      {election.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="file" className="text-sm font-medium">
              Upload Excel File
            </Label>
            <div className="flex items-center gap-4">
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                required
                aria-label="Upload Excel file with voter information"
              />
              <FileSpreadsheet
                className="h-6 w-6 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              File must be an Excel (.xlsx, .xls) with columns: name (required),
              phoneNumber, voterId
            </p>
          </div>

          {errorDetails.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Upload Errors</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5 space-y-1">
                  {nameErrors.length > 0 && (
                    <>
                      <li className="font-semibold">Name Errors:</li>
                      {nameErrors.map((err, index) => (
                        <li key={`name-${index}`}>{err}</li>
                      ))}
                    </>
                  )}
                  {phoneErrors.length > 0 && (
                    <>
                      <li className="font-semibold mt-2">
                        Phone Number Errors:
                      </li>
                      {phoneErrors.map((err, index) => (
                        <li key={`phone-${index}`}>{err}</li>
                      ))}
                    </>
                  )}
                  {voterIdErrors.length > 0 && (
                    <>
                      <li className="font-semibold mt-2">Voter ID Errors:</li>
                      {voterIdErrors.map((err, index) => (
                        <li key={`voterId-${index}`}>{err}</li>
                      ))}
                    </>
                  )}
                  {otherErrors.length > 0 && (
                    <>
                      <li className="font-semibold mt-2">Other Errors:</li>
                      {otherErrors.map((err, index) => (
                        <li key={`other-${index}`}>{err}</li>
                      ))}
                    </>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={isUploading || !electionId || !file}
              aria-label="Upload voters"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? "Uploading..." : "Upload Voters"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default VoterUpload;
