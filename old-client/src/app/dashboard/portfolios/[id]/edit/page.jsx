"use client";
import { useParams } from "next/navigation";
import PortfolioForm from "@/components/portfolios/PortfolioForm";

const UpdatePortfolioPage = () => {
  const { id } = useParams();

  return (
    <div>
      <PortfolioForm portfolioId={id} />
    </div>
  );
};

export default UpdatePortfolioPage;
