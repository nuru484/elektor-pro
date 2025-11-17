"use client";
import { useParams } from "next/navigation";
import { useGetCandidatesByElectionQuery } from "@/redux/api/apiSlice";

const page = () => {
  const { id } = useParams();
  const {
    data: candidate,
    error,
    isLoading,
  } = useGetCandidatesByElectionQuery(id);
  return (
    <div>
      {isLoading && <p>Loading Candidate details...</p>}
      {error && <p>Error loading Candidate details.</p>}
      {candidate && (
        <div className="p-4 bg-white shadow rounded-lg">
          <h1 className="text-2xl font-bold mb-4">{candidate.name}</h1>
        </div>
      )}
    </div>
  );
};

export default page;
