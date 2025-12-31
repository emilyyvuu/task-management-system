import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Organization } from "../types";

type OrgsResponse = { organizations: Organization[] };
type OrgResponse = { organization: { id: string; name: string } };

export default function OrgSelectPage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leavingOrgId, setLeavingOrgId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await authFetch<OrgsResponse>("/api/orgs");
        if (active) setOrgs(data.organizations);
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [authFetch]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    setLeaveError(null);

    try {
      const data = await authFetch<OrgResponse>("/api/orgs", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });

      setOrgs((prev) => [...prev, { ...data.organization, role: "ADMIN" }]);
      setName("");
      navigate(`/orgs/${data.organization.id}/projects`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeave = async (org: Organization) => {
    const confirmed = window.confirm(`Leave ${org.name}?`);
    if (!confirmed) return;

    setLeavingOrgId(org.id);
    setLeaveError(null);

    try {
      await authFetch(`/api/orgs/${org.id}/me`, { method: "DELETE" });
      setOrgs((prev) => prev.filter((item) => item.id !== org.id));
    } catch (err) {
      setLeaveError(getErrorMessage(err));
    } finally {
      setLeavingOrgId(null);
    }
  };

  const displayError = leaveError ?? error;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Organizations</h1>
          <p className="text-sm text-slate-500">Pick a workspace or create a new one.</p>
        </div>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New organization name"
            className="w-64 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Create
          </button>
        </form>
      </div>

      {displayError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
          {displayError}
        </p>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading organizations...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {orgs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              No organizations yet. Create one to get started.
            </div>
          ) : (
            orgs.map((org) => (
              <div
                key={org.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-slate-300"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{org.name}</p>
                  <p className="text-xs text-slate-500">{org.role ?? "Member"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/orgs/${org.id}/projects`)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLeave(org)}
                    disabled={leavingOrgId === org.id}
                    className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Leave
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
