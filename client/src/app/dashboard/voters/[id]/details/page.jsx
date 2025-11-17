"use client";
import { useParams } from "next/navigation";
const page = () => {
  const { id } = useParams();
  return <div>Voter Edit Page for ID: {id}</div>;
};

export default page;
