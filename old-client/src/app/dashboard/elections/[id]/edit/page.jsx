"use client";
import { useParams } from "next/navigation";
import ElectionForm from "@/components/elections/ElectionForm";

const UpdateElectionPage = () => {
  const { id } = useParams();

  return <ElectionForm electionId={id} />;
};

export default UpdateElectionPage;
