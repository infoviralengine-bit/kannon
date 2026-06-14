import { Navigate } from "react-router-dom";
export default function PaymentsPayablePage() {
  return <Navigate to="/dashboard/finance?tab=payable" replace />;
}
