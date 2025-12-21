import { Router } from "express";
import { pool } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";

export const auditRouter = Router();

/**
 * GET /api/projects/:projectId/audit
 * Returns audit logs for a project (members only)
 */
auditRouter.get("/projects/:projectId/audit", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const projectId = req.params.projectId;

  const proj = await pool.query(
    "select org_id as \"orgId\" from projects where id = $1",
    [projectId]
  );
  if (!proj.rowCount) return res.status(404).json({ error: "Project not found" });

  const orgId = proj.rows[0].orgId;

  const member = await pool.query(
    "select 1 from memberships where org_id = $1 and user_id = $2",
    [orgId, userId]
  );
  if (!member.rowCount) return res.status(403).json({ error: "Forbidden" });

  const logs = await pool.query(
    `
    select
      a.id,
      a.action,
      a.metadata,
      a.created_at as "createdAt",
      a.task_id as "taskId",
      a.actor_user_id as "actorUserId",
      u.email as "actorEmail"
    from audit_logs a
    join users u on u.id = a.actor_user_id
    where a.project_id = $1
    order by a.created_at desc
    limit 200
    `,
    [projectId]
  );

  return res.json({ audit: logs.rows });
});