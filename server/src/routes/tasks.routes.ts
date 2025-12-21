import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { newId } from "../utils/ids";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { logAudit } from "../audit/logAudit";

export const tasksRouter = Router();

/**
 * Helper: given a projectId and userId, verify:
 * - project exists
 * - user is member of the project's org
 * Returns orgId if allowed.
 */
async function getOrgIdIfProjectAccessAllowed(projectId: string, userId: string): Promise<string | null> {
  const proj = await pool.query(
    "select org_id as \"orgId\" from projects where id = $1",
    [projectId]
  );
  if (!proj.rowCount) return null;

  const orgId = proj.rows[0].orgId;

  const member = await pool.query(
    "select 1 from memberships where org_id = $1 and user_id = $2",
    [orgId, userId]
  );
  if (!member.rowCount) return null;

  return orgId;
}

/**
 * POST /api/projects/:projectId/tasks
 * Creates a task (defaults to Backlog column if you pass columnId or we auto-find Backlog)
 */
tasksRouter.post("/projects/:projectId/tasks", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const projectId = req.params.projectId;

  const orgId = await getOrgIdIfProjectAccessAllowed(projectId, userId);
  if (!orgId) return res.status(403).json({ error: "Forbidden" });

  const schema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    dueDate: z.string().datetime().optional(), 
    columnId: z.string().optional()            
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const { title, description, priority, dueDate, columnId } = parsed.data;

  let finalColumnId = columnId;
  if (!finalColumnId) {
    const backlog = await pool.query(
      "select id from columns where project_id = $1 and position = 0",
      [projectId]
    );
    if (!backlog.rowCount) return res.status(500).json({ error: "Backlog column not found" });
    finalColumnId = backlog.rows[0].id;
  }

  const col = await pool.query(
    "select id from columns where id = $1 and project_id = $2",
    [finalColumnId, projectId]
  );
  if (!col.rowCount) return res.status(400).json({ error: "Invalid columnId for this project" });

  const taskId = newId();
  const nowResult = await pool.query(
    `insert into tasks
      (id, org_id, project_id, column_id, title, description, priority, due_date, created_at, updated_at)
     values
      ($1,$2,$3,$4,$5,$6,$7,$8, now(), now())
     returning id, org_id as "orgId", project_id as "projectId", column_id as "columnId",
               title, description, priority, due_date as "dueDate", created_at as "createdAt", updated_at as "updatedAt"`,
    [
      taskId,
      orgId,
      projectId,
      finalColumnId,
      title,
      description ?? null,
      priority ?? "MEDIUM",
      dueDate ? new Date(dueDate) : null
    ]
  );

  await logAudit({
  orgId,
  projectId,
  actorUserId: userId,
  taskId: taskId,
  action: "task.created",
  metadata: {
    title,
    columnId: finalColumnId,
    priority: priority ?? "MEDIUM",
    dueDate: dueDate ?? null
  }
});

  return res.status(201).json({ task: nowResult.rows[0] });
});

/**
 * PATCH /api/tasks/:taskId
 * Edit basic fields (title, description, priority, dueDate, assignee later)
 */
tasksRouter.patch("/tasks/:taskId", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const taskId = req.params.taskId;

  const task = await pool.query(
    "select org_id as \"orgId\", project_id as \"projectId\" from tasks where id = $1",
    [taskId]
  );
  if (!task.rowCount) return res.status(404).json({ error: "Task not found" });

  const { orgId, projectId } = task.rows[0];

  const member = await pool.query(
    "select 1 from memberships where org_id = $1 and user_id = $2",
    [orgId, userId]
  );
  if (!member.rowCount) return res.status(403).json({ error: "Forbidden" });

  const schema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    dueDate: z.string().datetime().nullable().optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const { title, description, priority, dueDate } = parsed.data;

  const fields: string[] = [];
  const values: any[] = [];
  let i = 1;

  if (title !== undefined) { fields.push(`title = $${i++}`); values.push(title); }
  if (description !== undefined) { fields.push(`description = $${i++}`); values.push(description); }
  if (priority !== undefined) { fields.push(`priority = $${i++}`); values.push(priority); }
  if (dueDate !== undefined) { fields.push(`due_date = $${i++}`); values.push(dueDate ? new Date(dueDate) : null); }

  if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });

  fields.push(`updated_at = now()`);

  values.push(taskId);

  const changedFields = Object.keys(req.body);

  const updated = await pool.query(
    `update tasks set ${fields.join(", ")}
     where id = $${i}
     returning id, org_id as "orgId", project_id as "projectId", column_id as "columnId",
               title, description, priority, due_date as "dueDate", created_at as "createdAt", updated_at as "updatedAt"`,
    values
  );

  await logAudit({
    orgId,
    projectId,
    actorUserId: userId,
    taskId,
    action: "task.updated",
    metadata: {
      changedFields
    }
  });

  return res.json({ task: updated.rows[0] });
});

/**
 * POST /api/tasks/:taskId/move
 * Move a task to another column
 */
tasksRouter.post("/tasks/:taskId/move", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const taskId = req.params.taskId;

  const schema = z.object({ toColumnId: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { toColumnId } = parsed.data;

  // Get task's project + org
  const task = await pool.query(
    "select org_id as \"orgId\", project_id as \"projectId\", column_id as \"fromColumnId\" from tasks where id = $1",
    [taskId]
  );
  if (!task.rowCount) return res.status(404).json({ error: "Task not found" });

  const { orgId, projectId } = task.rows[0];

  // Verify membership
  const member = await pool.query(
    "select 1 from memberships where org_id = $1 and user_id = $2",
    [orgId, userId]
  );
  if (!member.rowCount) return res.status(403).json({ error: "Forbidden" });

  // Ensure destination column belongs to same project
  const dest = await pool.query(
    "select id from columns where id = $1 and project_id = $2",
    [toColumnId, projectId]
  );
  if (!dest.rowCount) return res.status(400).json({ error: "Destination column is not in this project" });

  const moved = await pool.query(
    `update tasks set column_id = $1, updated_at = now()
     where id = $2
     returning id, org_id as "orgId", project_id as "projectId", column_id as "columnId",
               title, description, priority, due_date as "dueDate", created_at as "createdAt", updated_at as "updatedAt"`,
    [toColumnId, taskId]
  );

  await logAudit({
  orgId,
  projectId,
  actorUserId: userId,
  taskId,
  action: "task.moved",
  metadata: {
    fromColumnId: task.rows[0].fromColumnId,
    toColumnId
  }
});

  return res.json({ task: moved.rows[0] });
});

/**
 * DELETE /api/tasks/:taskId
 */
tasksRouter.delete("/tasks/:taskId", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const taskId = req.params.taskId;

  const task = await pool.query(
    "select org_id as \"orgId\", project_id as \"projectId\" from tasks where id = $1",
    [taskId]
  );

  if (!task.rowCount) return res.status(404).json({ error: "Task not found" });

  const orgId = task.rows[0].orgId;

  const member = await pool.query(
    "select 1 from memberships where org_id = $1 and user_id = $2",
    [orgId, userId]
  );
  if (!member.rowCount) return res.status(403).json({ error: "Forbidden" });

  await logAudit({
    orgId,
    projectId: task.rows[0].projectId,
    actorUserId: userId,
    taskId,
    action: "task.deleted",
    metadata: {}
  });

  await pool.query("delete from tasks where id = $1", [taskId]);
  return res.status(204).send();
});