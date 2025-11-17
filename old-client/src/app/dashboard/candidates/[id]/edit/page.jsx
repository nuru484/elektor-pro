"use client";
import { useParams } from "next/navigation";
import CandidateForm from "@/components/candidates/CandidateForm";

const UpdateCandidatePage = () => {
  const { id } = useParams();

  return (
    <div>
      <CandidateForm candidateId={id} />
    </div>
  );
};

export default UpdateCandidatePage;
