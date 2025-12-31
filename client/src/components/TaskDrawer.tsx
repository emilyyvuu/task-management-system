import { useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Column, Comment, Label, Member, Task, TaskPriority } from "../types";

export type TaskUpdatePayload = {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeUserId?: string | null;
};

type TaskDrawerProps = {
  task: Task;
  columns: Column[];
  orgId: string;
  onClose: () => void;
  onUpdate: (taskId: string, payload: TaskUpdatePayload) => Promise<void>;
  onMove: (taskId: string, columnId: string) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onLabelsUpdated?: (taskId: string, labels: Label[]) => void;
};

type MembersResponse = { members: Member[] };
type OrgLabelsResponse = { labels: Label[] };
type TaskLabelsResponse = { labels: Label[] };
type CommentsResponse = { comments: Comment[] };
type LabelCreateResponse = { label: Label };
type CommentCreateResponse = { comment: Comment };

const priorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function toDateValue(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function areIdSetsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  for (const id of a) {
    if (!setB.has(id)) return false;
  }
  return true;
}

export default function TaskDrawer({
  task,
  columns,
  orgId,
  onClose,
  onUpdate,
  onMove,
  onDelete,
  onLabelsUpdated,
}: TaskDrawerProps) {
  const { authFetch } = useAuth();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority ?? "MEDIUM");
  const [dueDate, setDueDate] = useState(toDateValue(task.dueDate));
  const [columnId, setColumnId] = useState(task.columnId);
  const [assigneeId, setAssigneeId] = useState(task.assigneeUserId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sideError, setSideError] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [initialLabelIds, setInitialLabelIds] = useState<string[]>([]);
  const [labelName, setLabelName] = useState("");
  const [labelSubmitting, setLabelSubmitting] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(true);

  const originalDate = useMemo(() => toDateValue(task.dueDate), [task.dueDate]);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setPriority(task.priority ?? "MEDIUM");
    setDueDate(toDateValue(task.dueDate));
    setColumnId(task.columnId);
    setAssigneeId(task.assigneeUserId ?? "");
    setCommentBody("");
    setError(null);
    setSideError(null);
  }, [task]);

  useEffect(() => {
    let active = true;
    setMetaLoading(true);
    setSideError(null);

    const loadMeta = async () => {
      try {
        const [membersData, labelsData] = await Promise.all([
          authFetch<MembersResponse>(`/api/orgs/${orgId}/members`),
          authFetch<OrgLabelsResponse>(`/api/orgs/${orgId}/labels`),
        ]);
        if (!active) return;
        setMembers(membersData.members);
        setLabels(labelsData.labels);
      } catch (err) {
        if (active) setSideError(getErrorMessage(err));
      } finally {
        if (active) setMetaLoading(false);
      }
    };

    void loadMeta();

    return () => {
      active = false;
    };
  }, [authFetch, orgId]);

  useEffect(() => {
    let active = true;
    setCommentsLoading(true);
    setSideError(null);

    const loadTaskMeta = async () => {
      try {
        const [taskLabelsData, commentsData] = await Promise.all([
          authFetch<TaskLabelsResponse>(`/api/tasks/${task.id}/labels`),
          authFetch<CommentsResponse>(`/api/tasks/${task.id}/comments`),
        ]);
        if (!active) return;
        const labelIds = taskLabelsData.labels.map((label) => label.id);
        setSelectedLabelIds(labelIds);
        setInitialLabelIds(labelIds);
        setComments(commentsData.comments);
      } catch (err) {
        if (active) setSideError(getErrorMessage(err));
      } finally {
        if (active) setCommentsLoading(false);
      }
    };

    void loadTaskMeta();

    return () => {
      active = false;
    };
  }, [authFetch, task.id]);

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  const handleCreateLabel = async () => {
    const trimmed = labelName.trim();
    if (!trimmed) return;

    setLabelSubmitting(true);
    setSideError(null);

    try {
      const data = await authFetch<LabelCreateResponse>(`/api/orgs/${orgId}/labels`, {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      setLabels((prev) => [...prev, data.label]);
      setSelectedLabelIds((prev) => [...prev, data.label.id]);
      setLabelName("");
    } catch (err) {
      setSideError(getErrorMessage(err));
    } finally {
      setLabelSubmitting(false);
    }
  };

  const handleAddComment = async () => {
    const trimmed = commentBody.trim();
    if (!trimmed) return;

    setCommentSubmitting(true);
    setSideError(null);

    try {
      const data = await authFetch<CommentCreateResponse>(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: trimmed }),
      });
      setComments((prev) => [...prev, data.comment]);
      setCommentBody("");
    } catch (err) {
      setSideError(getErrorMessage(err));
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }

    const payload: TaskUpdatePayload = {};
    if (trimmedTitle !== task.title) payload.title = trimmedTitle;

    const normalizedDescription = description.trim();
    if (normalizedDescription !== (task.description ?? "")) {
      payload.description = normalizedDescription.length ? normalizedDescription : null;
    }

    if (priority !== (task.priority ?? "MEDIUM")) {
      payload.priority = priority;
    }

    if (dueDate !== originalDate) {
      payload.dueDate = dueDate ? new Date(dueDate).toISOString() : null;
    }

    const originalAssignee = task.assigneeUserId ?? "";
    if (assigneeId !== originalAssignee) {
      payload.assigneeUserId = assigneeId ? assigneeId : null;
    }

    const normalizedLabelIds = Array.from(new Set(selectedLabelIds));
    const labelsChanged = !areIdSetsEqual(normalizedLabelIds, initialLabelIds);

    setSaving(true);
    setError(null);

    try {
      if (Object.keys(payload).length > 0) {
        await onUpdate(task.id, payload);
      }
      if (columnId !== task.columnId) {
        await onMove(task.id, columnId);
      }
      if (labelsChanged) {
        await authFetch(`/api/tasks/${task.id}/labels`, {
          method: "PUT",
          body: JSON.stringify({ labelIds: normalizedLabelIds }),
        });
        setInitialLabelIds(normalizedLabelIds);
        if (onLabelsUpdated) {
          const updatedLabels = labels.filter((label) => normalizedLabelIds.includes(label.id));
          onLabelsUpdated(task.id, updatedLabels);
        }
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm("Delete this task?");
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    try {
      await onDelete(task.id);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
      <div className="flex h-full w-full max-w-lg flex-col gap-6 overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Task</p>
            <h2 className="text-xl font-semibold text-slate-900">Edit details</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            Close
          </button>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Priority
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              >
                {priorities.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Column
            <select
              value={columnId}
              onChange={(event) => setColumnId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            >
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Assignee
            <select
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              disabled={metaLoading}
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.email}
                </option>
              ))}
            </select>
          </label>

          <section className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Labels</h3>
              <span className="text-xs text-slate-400">{selectedLabelIds.length} selected</span>
            </div>

            {metaLoading ? (
              <p className="mt-2 text-xs text-slate-400">Loading labels...</p>
            ) : labels.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">No labels yet.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {labels.map((label) => {
                  const isSelected = selectedLabelIds.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => toggleLabel(label.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        isSelected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {label.name}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <input
                value={labelName}
                onChange={(event) => setLabelName(event.target.value)}
                placeholder="New label name"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleCreateLabel()}
                disabled={labelSubmitting}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">Save changes to apply label updates.</p>
          </section>

          <section className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Comments</h3>
              <span className="text-xs text-slate-400">{comments.length}</span>
            </div>

            {commentsLoading ? (
              <p className="mt-2 text-xs text-slate-400">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">No comments yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-600">{comment.authorEmail}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(comment.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{comment.body}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 space-y-2">
              <textarea
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                rows={3}
                placeholder="Add a comment..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleAddComment()}
                disabled={commentSubmitting || commentBody.trim().length === 0}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add comment
              </button>
            </div>
          </section>

          {sideError ? <p className="text-sm text-rose-600">{sideError}</p> : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
