"use client";
import { useParams } from "next/navigation";

const page = () => {
  const { id } = useParams();

  return <div>Details for Candidate ID: {id}</div>;
};

export default page;
