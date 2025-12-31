import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import LoadingScreen from "./LoadingScreen";

export default function PublicOnly() {
  const { status } = useAuth();

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (status === "authenticated") {
    return <Navigate to="/select-org" replace />;
  }

  return <Outlet />;
}
