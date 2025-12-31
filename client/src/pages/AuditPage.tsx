import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Project } from "../types";

type AuditEntry = {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  taskId?: string | null;
  actorEmail: string;
};

type AuditResponse = { audit: AuditEntry[] };
type ProjectsResponse = { projects: Project[] };

export default function AuditPage() {
  const { orgId } = useParams();
  const { authFetch } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let active = true;

    const loadProjects = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await authFetch<ProjectsResponse>(`/api/orgs/${orgId}/projects`);
        if (active) {
          setProjects(data.projects);
          if (data.projects.length > 0) {
            setSelectedProjectId(data.projects[0].id);
          }
        }
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadProjects();

    return () => {
      active = false;
    };
  }, [authFetch, orgId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    let active = true;

    const loadAudit = async () => {
      setError(null);
      try {
        const data = await authFetch<AuditResponse>(`/api/projects/${selectedProjectId}/audit`);
        if (active) setAudit(data.audit);
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      }
    };

    void loadAudit();

    return () => {
      active = false;
    };
  }, [authFetch, selectedProjectId]);

  if (!orgId) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6">Missing organization.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-500">Track the most recent changes per project.</p>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">{error}</p>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Project
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Loading audit log...</p>
        ) : audit.length === 0 ? (
          <p className="text-sm text-slate-500">No activity yet.</p>
        ) : (
          <div className="space-y-3">
            {audit.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-600">{entry.action}</p>
                  <p className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
                <p className="text-xs text-slate-500">Actor: {entry.actorEmail}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
