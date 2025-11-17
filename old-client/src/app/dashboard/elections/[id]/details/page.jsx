"use client";
import { useParams } from "next/navigation";
import { useGetElectionQuery } from "@/redux/api/apiSlice";

const page = () => {
  const { id } = useParams();
  const { data: election, error, isLoading } = useGetElectionQuery(id);
  return (
    <div>
      {isLoading && <p>Loading election details...</p>}
      {error && <p>Error loading election details.</p>}
      {election && (
        <div className="p-4 bg-white shadow rounded-lg">
          <h1 className="text-2xl font-bold mb-4">{election.name}</h1>
          <p className="text-gray-700 mb-2">
            Description: {election.description}
          </p>
          <p className="text-gray-700 mb-2">
            Start Date: {new Date(election.startDate).toLocaleDateString()}
          </p>
          <p className="text-gray-700 mb-2">
            End Date: {new Date(election.endDate).toLocaleDateString()}
          </p>
          <p className="text-gray-700 mb-2">
            Status: {election.isActive ? "Active" : "Inactive"}
          </p>
        </div>
      )}
    </div>
  );
};

export default page;
