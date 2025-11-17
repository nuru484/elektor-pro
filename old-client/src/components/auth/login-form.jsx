"use client";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Lock, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { signin } from "@/actions/auth";

// Define the form schema using Zod
const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(4, "Password must be at least 4 characters"),
  rememberMe: z.boolean().default(false),
  redirectTo: z.string().optional(),
});

export default function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const [state, action, pending] = useActionState(signin, undefined);

  // Initialize the form with react-hook-form
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
      redirectTo: callbackUrl,
    },
  });

  return (
    <div className="flex min-h-screen flex-col justify-center px-4 sm:px-6 lg:px-8 bg-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card p-6 sm:p-8 rounded-2xl shadow-lg border border-border">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">
              Voting System
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          <Form {...form}>
            <form action={action} className="space-y-6">
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
                          type="password"
                          placeholder="••••••••"
                          className="pl-10 bg-input border-input focus:ring-2 focus:ring-ring"
                          {...field}
                        />
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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

              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="border-input"
                        />
                      </FormControl>
                      <FormLabel className="text-sm text-muted-foreground">
                        Remember me
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <a
                  href="#"
                  className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </a>
              </div>

              <input type="hidden" name="redirectTo" value={callbackUrl} />

              <Button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-lg shadow-md hover:shadow-lg transition-shadow"
                disabled={pending}
              >
                {pending ? "Signing In..." : "Sign In"}
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <a
                    href="/signup"
                    className="font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Sign up
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
