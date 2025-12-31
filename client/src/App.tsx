import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import PublicOnly from "./components/PublicOnly";
import RequireAuth from "./components/RequireAuth";
import RequireOrgAdmin from "./components/RequireOrgAdmin";
import { AuthProvider } from "./lib/auth";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import AdminPage from "./pages/AdminPage";
import AuditPage from "./pages/AuditPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import OrgSelectPage from "./pages/OrgSelectPage";
import ProjectBoardPage from "./pages/ProjectBoardPage";
import ProjectListPage from "./pages/ProjectListPage";
import SignupPage from "./pages/SignupPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Route>

          <Route path="/accept-invite" element={<AcceptInvitePage />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/select-org" replace />} />
              <Route path="/select-org" element={<OrgSelectPage />} />
              <Route path="/orgs/:orgId/projects" element={<ProjectListPage />} />
              <Route path="/orgs/:orgId/projects/:projectId/board" element={<ProjectBoardPage />} />
              <Route path="/orgs/:orgId/admin" element={<RequireOrgAdmin />}>
                <Route index element={<AdminPage />} />
              </Route>
              <Route path="/orgs/:orgId/audit" element={<AuditPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
