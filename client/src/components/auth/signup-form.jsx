// src/components/signup-form.jsx
"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, Phone, Eye, EyeOff, ArrowRight } from "lucide-react";
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
import { signup } from "@/actions/auth";
import toast, { Toaster } from "react-hot-toast";
import { SignupFormSchema } from "@/validation/signup-validation";

export default function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  // Initialize the form with react-hook-form
  const form = useForm({
    resolver: zodResolver(SignupFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      phone: "",
    },
  });

  // Handle success state and redirect
  useEffect(() => {
    if (state?.success) {
      toast.success(state.message || "Account created successfully!");
      const timer = setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state, router]);

  // Custom form submit handler
  const onSubmit = async (data) => {
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("email", data.email);
    formData.append("password", data.password);
    formData.append("phone", data.phone);

    action(formData);
  };

  return (
    <div className="flex min-h-screen flex-col justify-center px-4 sm:px-6 lg:px-8 bg-background">
      <Toaster position="top-center" reverseOrder={false} />
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card p-6 sm:p-8 rounded-2xl shadow-lg border border-border">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">
              Voting System
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Create an account to get started
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="John Doe"
                          className="pl-10 bg-input border-input focus:ring-2 focus:ring-ring"
                          {...field}
                        />
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </FormControl>
                    <FormMessage />
                    {state?.errors?.name && (
                      <p className="text-sm text-destructive">
                        {state.errors.name}
                      </p>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="you@example.com"
                          className="pl-10 bg-input border-input focus:ring-2 focus:ring-ring"
                          {...field}
                        />
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </FormControl>
                    <FormMessage />
                    {state?.errors?.email && (
                      <p className="text-sm text-destructive">
                        {state.errors.email}
                      </p>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-10 pr-10 bg-input border-input focus:ring-2 focus:ring-ring"
                          {...field}
                        />
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                    {state?.errors?.password && (
                      <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                        <ul className="list-disc pl-5 space-y-1">
                          {state.errors.password.map((error) => (
                            <li
                              key={error}
                              className="text-sm text-destructive"
                            >
                              {error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="123-456-7890"
                          className="pl-10 bg-input border-input focus:ring-2 focus:ring-ring"
                          {...field}
                        />
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </FormControl>
                    <FormMessage />
                    {state?.errors?.phone && (
                      <p className="text-sm text-destructive">
                        {state.errors.phone}
                      </p>
                    )}
                  </FormItem>
                )}
              />

              {/* Handle general errors (like super admin already exists) */}
              {state?.errors?.general && (
                <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  <ul className="list-disc pl-5 space-y-1">
                    {state.errors.general.map((error, index) => (
                      <li key={index} className="text-sm text-destructive">
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Handle single error field */}
              {state?.error && (
                <p className="text-sm text-destructive text-center">
                  {state.error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-lg shadow-md hover:shadow-lg transition-shadow"
                disabled={pending}
              >
                {pending ? "Creating Account..." : "Create Account"}
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <a
                    href="/login"
                    className="font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Sign in
                  </a>
                </p>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
