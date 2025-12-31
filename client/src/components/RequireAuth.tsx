import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import LoadingScreen from "./LoadingScreen";

export default function RequireAuth() {
  const { status } = useAuth();

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
