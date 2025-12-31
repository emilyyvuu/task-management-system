import { Navigate, Outlet, useOutletContext, useParams } from "react-router-dom";
import LoadingScreen from "./LoadingScreen";

type OrgOutletContext = {
  orgRole: "ADMIN" | "MEMBER" | null;
  orgRoleLoading: boolean;
};

export default function RequireOrgAdmin() {
  const { orgId } = useParams();
  const { orgRole, orgRoleLoading } = useOutletContext<OrgOutletContext>();

  if (orgRoleLoading) {
    return <LoadingScreen />;
  }

  if (orgRole !== "ADMIN") {
    return <Navigate to={orgId ? `/orgs/${orgId}/projects` : "/select-org"} replace />;
  }

  return <Outlet />;
}
