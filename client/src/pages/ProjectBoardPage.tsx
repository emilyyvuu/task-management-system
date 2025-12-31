import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import TaskDrawer, { type TaskUpdatePayload } from "../components/TaskDrawer";
import { getErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Column, Label, Member, Task } from "../types";

type BoardResponse = { columns: Column[] };
type TaskResponse = { task: Task };
type TaskLabelsResponse = { labels: Label[] };
type MembersResponse = { members: Member[] };

export default function ProjectBoardPage() {
  const { orgId, projectId } = useParams();
  const { authFetch } = useAuth();
  const [columns, setColumns] = useState<Column[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [taskLabels, setTaskLabels] = useState<Record<string, Label[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [labelsLoading, setLabelsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropColumnId, setDropColumnId] = useState<string | null>(null);

  const activeTask = useMemo(() => {
    if (!activeTaskId) return null;
    for (const column of columns) {
      const found = column.tasks.find((task) => task.id === activeTaskId);
      if (found) return found;
    }
    return null;
  }, [activeTaskId, columns]);

  const membersById = useMemo(() => {
    const map: Record<string, Member> = {};
    for (const member of members) {
      map[member.userId] = member;
    }
    return map;
  }, [members]);

  const loadTaskLabels = useCallback(
    async (boardColumns: Column[]) => {
      const tasks = boardColumns.flatMap((column) => column.tasks);
      if (tasks.length === 0) {
        setTaskLabels({});
        return;
      }

      setLabelsLoading(true);
      try {
        const results = await Promise.all(
          tasks.map(async (task) => {
            const data = await authFetch<TaskLabelsResponse>(`/api/tasks/${task.id}/labels`);
            return { taskId: task.id, labels: data.labels };
          })
        );

        setTaskLabels((prev) => {
          const next: Record<string, Label[]> = { ...prev };
          for (const result of results) {
            next[result.taskId] = result.labels;
          }
          return next;
        });
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLabelsLoading(false);
      }
    },
    [authFetch]
  );

  useEffect(() => {
    if (!orgId) return;
    let active = true;

    const loadMembers = async () => {
      try {
        const data = await authFetch<MembersResponse>(`/api/orgs/${orgId}/members`);
        if (active) setMembers(data.members);
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      }
    };

    void loadMembers();

    return () => {
      active = false;
    };
  }, [authFetch, orgId]);

  const loadBoard = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authFetch<BoardResponse>(`/api/projects/${projectId}/board`);
      setColumns(data.columns);
      await loadTaskLabels(data.columns);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [authFetch, projectId, loadTaskLabels]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const updateDraft = (columnId: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [columnId]: value }));
  };

  const addTask = async (columnId: string) => {
    if (!projectId) return;
    const title = (drafts[columnId] ?? "").trim();
    if (!title) return;

    try {
      const data = await authFetch<TaskResponse>(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title, columnId }),
      });

      setColumns((prev) =>
        prev.map((column) =>
          column.id === data.task.columnId
            ? { ...column, tasks: [...column.tasks, data.task] }
            : column
        )
      );
      setTaskLabels((prev) => ({ ...prev, [data.task.id]: [] }));
      updateDraft(columnId, "");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const updateTask = async (taskId: string, payload: TaskUpdatePayload) => {
    const data = await authFetch<TaskResponse>(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    setColumns((prev) =>
      prev.map((column) => ({
        ...column,
        tasks: column.tasks.map((task) => (task.id === taskId ? data.task : task)),
      }))
    );
  };

  const moveTask = async (taskId: string, toColumnId: string) => {
    const data = await authFetch<TaskResponse>(`/api/tasks/${taskId}/move`, {
      method: "POST",
      body: JSON.stringify({ toColumnId }),
    });

    setColumns((prev) => {
      let movedTask: Task | null = null;

      const stripped = prev.map((column) => {
        const tasks = column.tasks.filter((task) => {
          if (task.id === taskId) {
            movedTask = task;
            return false;
          }
          return true;
        });
        return { ...column, tasks };
      });

      const resolvedTask = data.task ?? movedTask;
      if (!resolvedTask) return prev;

      const finalTask =
        resolvedTask.columnId === toColumnId
          ? resolvedTask
          : { ...resolvedTask, columnId: toColumnId };

      return stripped.map((column) =>
        column.id === toColumnId ? { ...column, tasks: [...column.tasks, finalTask] } : column
      );
    });
  };

  const deleteTask = async (taskId: string) => {
    await authFetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    setColumns((prev) =>
      prev.map((column) => ({
        ...column,
        tasks: column.tasks.filter((task) => task.id !== taskId),
      }))
    );
    setTaskLabels((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  };

  if (!orgId || !projectId) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6">Missing project.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Project Board</h1>
          <p className="text-sm text-slate-500">Move work across columns and keep priorities visible.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadBoard()}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">{error}</p>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading board...
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {columns.map((column) => (
            <div
              key={column.id}
              onDragOver={(event) => {
                event.preventDefault();
                setDropColumnId(column.id);
              }}
              onDragLeave={() => {
                setDropColumnId((current) => (current === column.id ? null : current));
              }}
              onDrop={(event) => {
                event.preventDefault();
                const taskId = event.dataTransfer.getData("text/plain");
                if (!taskId) return;
                const currentColumn = columns.find((col) => col.tasks.some((task) => task.id === taskId));
                if (currentColumn && currentColumn.id !== column.id) {
                  void moveTask(taskId, column.id);
                }
                setDropColumnId(null);
                setDraggingTaskId(null);
              }}
              className={`flex flex-col rounded-2xl border bg-white p-4 shadow-sm ${
                dropColumnId === column.id ? "border-slate-400 ring-2 ring-slate-200" : "border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">{column.name}</h2>
                <span className="text-xs text-slate-400">{column.tasks.length}</span>
              </div>

              <div className="mt-4 flex flex-1 flex-col gap-3">
                {column.tasks.length === 0 ? (
                  <p className="text-xs text-slate-400">No tasks yet.</p>
                ) : null}

                {column.tasks.map((task) => {
                  const labelsForTask = taskLabels[task.id] ?? [];
                  const assignee = task.assigneeUserId ? membersById[task.assigneeUserId] : null;

                  return (
                    <button
                      type="button"
                      key={task.id}
                      onClick={() => setActiveTaskId(task.id)}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", task.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggingTaskId(task.id);
                      }}
                      onDragEnd={() => setDraggingTaskId(null)}
                      className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm hover:border-slate-300 ${
                        draggingTaskId === task.id ? "opacity-70" : ""
                      }`}
                    >
                      <p className="font-medium text-slate-900">{task.title}</p>
                      <p className="mt-1 text-xs text-slate-500">Priority: {task.priority ?? "MEDIUM"}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {assignee ? (
                          <span className="rounded-full bg-slate-900/10 px-2 py-1 text-[10px] font-semibold text-slate-700">
                            {assignee.email}
                          </span>
                        ) : null}
                        {labelsForTask.map((label) => (
                          <span
                            key={label.id}
                            className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600"
                          >
                            {label.name}
                          </span>
                        ))}
                        {labelsLoading && labelsForTask.length === 0 ? (
                          <span className="text-[10px] text-slate-400">Loading labels...</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              <form
                className="mt-4 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addTask(column.id);
                }}
              >
                <input
                  value={drafts[column.id] ?? ""}
                  onChange={(event) => updateDraft(column.id, event.target.value)}
                  placeholder="Add task..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Add
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {activeTask ? (
        <TaskDrawer
          task={activeTask}
          columns={columns}
          orgId={orgId}
          onClose={() => setActiveTaskId(null)}
          onUpdate={updateTask}
          onMove={moveTask}
          onDelete={deleteTask}
          onLabelsUpdated={(taskId, labels) =>
            setTaskLabels((prev) => ({ ...prev, [taskId]: labels }))
          }
        />
      ) : null}
    </div>
  );
}
