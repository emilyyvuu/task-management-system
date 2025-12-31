import { useEffect, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import type { Member } from "../types";

const linkBase = "block rounded-lg px-3 py-2 text-sm font-medium transition";
const linkActive = "bg-slate-900 text-white";
const linkInactive = "text-slate-600 hover:bg-slate-100 hover:text-slate-900";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `${linkBase} ${isActive ? linkActive : linkInactive}`;

export default function AppShell() {
  const { user, logout, authFetch } = useAuth();
  const { orgId } = useParams();
  const [orgRole, setOrgRole] = useState<"ADMIN" | "MEMBER" | null>(null);
  const [orgRoleLoading, setOrgRoleLoading] = useState(false);

  useEffect(() => {
    if (!orgId || !user) {
      setOrgRole(null);
      return;
    }

    let active = true;
    setOrgRoleLoading(true);

    const loadRole = async () => {
      try {
        const data = await authFetch<{ members: Member[] }>(`/api/orgs/${orgId}/members`);
        if (!active) return;
        const me = data.members.find((member) => member.userId === user.id);
        setOrgRole(me?.role ?? null);
      } catch {
        if (active) setOrgRole(null);
      } finally {
        if (active) setOrgRoleLoading(false);
      }
    };

    void loadRole();

    return () => {
      active = false;
    };
  }, [authFetch, orgId, user]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <NavLink to="/" className="text-lg font-semibold text-slate-900">
            Task Manager
          </NavLink>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span>{user?.email}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-6 px-6 py-6">
        <aside className="w-56 shrink-0">
          <nav className="space-y-1">
            <NavLink to="/select-org" className={navLinkClass}>
              Organizations
            </NavLink>
            {orgId && (
              <>
                <NavLink to={`/orgs/${orgId}/projects`} className={navLinkClass}>
                  Projects
                </NavLink>
                {orgRole === "ADMIN" && !orgRoleLoading ? (
                  <NavLink to={`/orgs/${orgId}/admin`} className={navLinkClass}>
                    Admin Settings
                  </NavLink>
                ) : null}
                <NavLink to={`/orgs/${orgId}/audit`} className={navLinkClass}>
                  Audit Log
                </NavLink>
              </>
            )}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet context={{ orgRole, orgRoleLoading }} />
        </main>
      </div>
    </div>
  );
}
