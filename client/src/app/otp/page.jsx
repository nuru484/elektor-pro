import { Suspense } from "react";
import VoterOtpPage from "../../components/voters/VoterOtpPage";

export default function OtpPage() {
  return (
    <Suspense fallback={<div>Loading OTP page...</div>}>
      <VoterOtpPage />
    </Suspense>
  );
}
