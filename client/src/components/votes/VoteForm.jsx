"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateVoteMutation,
  useGetPortfoliosByElectionQuery,
} from "@/redux/api/apiSlice";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import io from "socket.io-client";

const voteSchema = z.object({
  votes: z
    .array(
      z.object({
        candidateId: z.string().refine((val) => !isNaN(parseInt(val)), {
          message: "Valid candidate ID is required.",
        }),
        portfolioId: z.string().refine((val) => !isNaN(parseInt(val)), {
          message: "Valid portfolio ID is required.",
        }),
        electionId: z.string().refine((val) => !isNaN(parseInt(val)), {
          message: "Valid election ID is required.",
        }),
      })
    )
    .min(1, { message: "At least one vote is required." }),
});

export default function VoteForm({ electionId }) {
  const router = useRouter();
  const [createVote, { isLoading }] = useCreateVoteMutation();
  const { data: portfoliosData, isLoading: isLoadingPortfolios } =
    useGetPortfoliosByElectionQuery(electionId);
  const portfolios = portfoliosData?.portfolios || [];
  const [socket, setSocket] = useState(null);

  // Initialize form
  const form = useForm({
    resolver: zodResolver(voteSchema),
    defaultValues: {
      votes: portfolios.map((portfolio) => ({
        candidateId: "",
        portfolioId: String(portfolio.portfolioId),
        electionId: String(electionId),
      })),
    },
  });

  // Initialize Socket.IO
  useEffect(() => {
    const socketInstance = io();
    socketInstance.emit("joinElection", electionId);
    setSocket(socketInstance);

    socketInstance.on("voteUpdate", (data) => {
      toast.success("Vote results updated!");
      console.log("Real-time vote update:", data);
      // Update UI with new vote counts
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [electionId]);

  // Update form defaults when portfolios load
  useEffect(() => {
    if (portfolios.length > 0) {
      form.reset({
        votes: portfolios.map((portfolio) => ({
          candidateId: "",
          portfolioId: String(portfolio.portfolioId),
          electionId: String(electionId),
        })),
      });
    }
  }, [portfolios, electionId, form]);

  const onSubmit = async (data) => {
    try {
      await createVote({ votes: data.votes }).unwrap();
      toast.success("Your vote has been recorded!");
      router.push("/dashboard/elections");
    } catch (error) {
      toast.error(error?.data?.error || "Failed to submit vote.");
    }
  };

  if (isLoadingPortfolios) {
    return <div>Loading portfolios...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <h2 className="text-2xl font-bold">Cast Your Vote</h2>
          {portfolios.map((portfolio, index) => (
            <FormField
              key={portfolio.portfolioId}
              control={form.control}
              name={`votes.${index}.candidateId`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{portfolio.portfolioName}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a candidate" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {portfolio.candidates.map((candidate) => (
                        <SelectItem
                          key={candidate.id}
                          value={String(candidate.id)}
                        >
                          {candidate.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Submitting..." : "Submit Vote"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
