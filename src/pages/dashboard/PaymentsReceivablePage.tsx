import { Navigate } from "react-router-dom";
export default function PaymentsReceivablePage() {
  return <Navigate to="/dashboard/finance?tab=receivable" replace />;
}
