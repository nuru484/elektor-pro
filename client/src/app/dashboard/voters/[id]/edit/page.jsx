"use client";
import { useParams } from "next/navigation";
import VoterForm from "@/components/voters/VoterForm";

const UpdateElectionPage = () => {
  const { id } = useParams();

  return (
    <div className="container mx-auto ">
      <VoterForm voterId={id} />;
    </div>
  );
};

export default UpdateElectionPage;
