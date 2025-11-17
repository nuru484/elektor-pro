"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSendVoterOTPMutation } from "@/redux/api/apiSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Mail } from "lucide-react";

// Define the form schema using Zod
const formSchema = z.object({
  voterId: z.string().min(1, "Voter ID is required"),
});

export default function VoterLoginPage() {
  const [errors, setErrors] = useState({});
  const [sendVoterOTP, { isLoading }] = useSendVoterOTPMutation();
  const router = useRouter();

  // Initialize the form with react-hook-form
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      voterId: "",
    },
  });

  const handleSubmit = async (data) => {
    console.log("Form submitted with data:", data); // Debug: Log form data
    setErrors({});

    try {
      console.log("Sending OTP for voterId:", data.voterId); // Debug: Log before API call
      const response = await sendVoterOTP(data.voterId).unwrap();
      console.log("API response:", response); // Debug: Log API response

      if (response.success) {
        console.log("OTP sent successfully, redirecting...");
        router.push(`/otp?voterId=${data.voterId}`);
      } else {
        console.log("API returned errors:", response.errors); // Debug: Log API errors
        setErrors(response.errors);
      }
    } catch (error) {
      console.error("Error sending OTP:", error); // Debug: Log error
      setErrors({ general: ["Failed to send OTP. Please try again."] });
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center px-4 sm:px-6 lg:px-8 bg-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card p-6 sm:p-8 rounded-2xl shadow-lg border border-border">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">Voter Login</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your Voter ID to receive an OTP
            </p>
          </div>

          {errors.general && (
            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20 mb-6">
              <p className="text-sm text-destructive">{errors.general[0]}</p>
            </div>
          )}

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="voterId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voter ID</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="Enter your Voter ID"
                          className="pl-10 bg-input border-input focus:ring-2 focus:ring-ring"
                          {...field}
                        />
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </FormControl>
                    <FormMessage />
                    {errors.voterId && (
                      <p className="text-sm text-destructive">
                        {errors.voterId[0]}
                      </p>
                    )}
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-lg shadow-md hover:shadow-lg transition-shadow"
                disabled={isLoading}
              >
                {isLoading ? "Sending..." : "Send OTP"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
