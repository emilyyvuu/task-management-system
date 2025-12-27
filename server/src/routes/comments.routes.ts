import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { newId } from "../utils/ids";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { logAudit } from "../audit/logAudit";

export const commentsRouter = Router();

/**
 * POST /api/tasks/:taskId/comments
 * Add a comment to a task.
 */
commentsRouter.post("/tasks/:taskId/comments", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const taskId = req.params.taskId;

  const schema = z.object({ body: z.string().min(1).max(5000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  // Load task org/project and verify membership
  const t = await pool.query(
    `select org_id as "orgId", project_id as "projectId" from tasks where id = $1`,
    [taskId]
  );
  if (!t.rowCount) return res.status(404).json({ error: "Task not found" });

  const { orgId, projectId } = t.rows[0];

  const member = await pool.query(
    `select 1 from memberships where org_id = $1 and user_id = $2`,
    [orgId, userId]
  );
  if (!member.rowCount) return res.status(403).json({ error: "Forbidden" });

  const commentId = newId();

  const inserted = await pool.query(
    `insert into comments (id, org_id, task_id, author_user_id, body)
     values ($1, $2, $3, $4, $5)
     returning id, task_id as "taskId", author_user_id as "authorUserId", body, created_at as "createdAt"`,
    [commentId, orgId, taskId, userId, parsed.data.body]
  );

  await logAudit({
    orgId,
    projectId,
    actorUserId: userId,
    taskId,
    action: "comment.added",
    metadata: { commentId }
  });

  return res.status(201).json({ comment: inserted.rows[0] });
});

/**
 * GET /api/tasks/:taskId/comments
 * List comments for a task.
 */
commentsRouter.get("/tasks/:taskId/comments", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const taskId = req.params.taskId;

  const t = await pool.query(
    `select org_id as "orgId" from tasks where id = $1`,
    [taskId]
  );
  if (!t.rowCount) return res.status(404).json({ error: "Task not found" });

  const { orgId } = t.rows[0];

  const member = await pool.query(
    `select 1 from memberships where org_id = $1 and user_id = $2`,
    [orgId, userId]
  );
  if (!member.rowCount) return res.status(403).json({ error: "Forbidden" });

  const result = await pool.query(
    `
    select
      c.id,
      c.body,
      c.created_at as "createdAt",
      c.author_user_id as "authorUserId",
      u.email as "authorEmail"
    from comments c
    join users u on u.id = c.author_user_id
    where c.task_id = $1
    order by c.created_at asc
    `,
    [taskId]
  );

  return res.json({ comments: result.rows });
});