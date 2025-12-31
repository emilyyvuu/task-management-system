import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Project } from "../types";

type ProjectsResponse = { projects: Project[] };
type ProjectResponse = { project: { id: string; orgId: string; name: string } };

export default function ProjectListPage() {
  const { orgId } = useParams();
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await authFetch<ProjectsResponse>(`/api/orgs/${orgId}/projects`);
        if (active) setProjects(data.projects);
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
  }, [authFetch, orgId]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);

    try {
      const data = await authFetch<ProjectResponse>(`/api/orgs/${orgId}/projects`, {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });

      setProjects((prev) => [...prev, { id: data.project.id, orgId: data.project.orgId, name: data.project.name }]);
      setName("");
      navigate(`/orgs/${orgId}/projects/${data.project.id}/board`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!orgId) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6">Missing organization.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500">Create a project to unlock a Kanban board.</p>
        </div>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New project name"
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

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading projects...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              No projects yet. Create one to get started.
            </div>
          ) : (
            projects.map((project) => (
              <div key={project.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{project.name}</p>
                <div className="mt-3 flex items-center gap-3">
                  <Link
                    to={`/orgs/${orgId}/projects/${project.id}/board`}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                  >
                    Open board
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
