"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVerifyVoterOTPMutation } from "@/redux/api/apiSlice";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
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
import { Lock } from "lucide-react";

// Define the form schema using Zod
const formSchema = z.object({
  otp: z.string().min(1, "OTP is required").max(6, "OTP must be 6 digits"),
});

export default function VoterOtpPage() {
  const [errors, setErrors] = useState({});
  const [verifyVoterOTP, { isLoading }] = useVerifyVoterOTPMutation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const voterId = searchParams.get("voterId");

  // Initialize the form with react-hook-form
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      otp: "",
    },
  });

  useEffect(() => {
    console.log("Voter Id from otp page: ", voterId);
    if (!voterId) {
      router.push("/voter-login");
    }
  }, [voterId, router]);

  const handleSubmit = async (data) => {
    setErrors({});

    if (!voterId) {
      setErrors({
        general: ["Voter ID is missing. Please try logging in again."],
      });
      return;
    }

    try {
      const response = await verifyVoterOTP({
        voterId,
        otp: data.otp,
      }).unwrap();

      console.log("Voter Id in otp page: ", voterId);

      if (response.success) {
        router.push("/dashboard");
      } else {
        setErrors(response.errors);
      }
    } catch (error) {
      const errorMessage =
        error.data?.errors?.otp?.[0] ||
        error.data?.errors?.general?.[0] ||
        "Unexpected error during OTP verification";
      setErrors({ general: [errorMessage] });
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center px-4 sm:px-6 lg:px-8 bg-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card p-6 sm:p-8 rounded-2xl shadow-lg border border-border">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">Verify OTP</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter the 6-digit OTP sent to your registered contact
            </p>
          </div>

          {(errors.general || errors.otp) && (
            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20 mb-6">
              <p className="text-sm text-destructive">
                {errors.otp?.[0] || errors.general?.[0]}
              </p>
            </div>
          )}

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OTP</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="Enter 6-digit OTP"
                          maxLength={6}
                          className="pl-10 bg-input border-input focus:ring-2 focus:ring-ring"
                          {...field}
                        />
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </FormControl>
                    <FormMessage />
                    {errors.otp && (
                      <p className="text-sm text-destructive">
                        {errors.otp[0]}
                      </p>
                    )}
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-lg shadow-md hover:shadow-lg transition-shadow"
                disabled={isLoading || !voterId}
              >
                {isLoading ? "Verifying..." : "Verify OTP"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
