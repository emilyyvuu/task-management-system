import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { newId } from "../utils/ids";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { requireOrgMember } from "../middleware/requireOrgMember";

export const labelsRouter = Router();

/**
 * POST /api/orgs/:orgId/labels
 * Creates a label in an org.
 */
labelsRouter.post(
  "/orgs/:orgId/labels",
  requireAuth,
  requireOrgMember,
  async (req: AuthedRequest, res) => {
    const orgId = req.params.orgId;

    const schema = z.object({ name: z.string().min(1).max(50) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    const name = parsed.data.name.trim();

    const created = await pool.query(
      `insert into labels (id, org_id, name)
       values ($1, $2, $3)
       returning id, org_id as "orgId", name, created_at as "createdAt"`,
      [newId(), orgId, name]
    );

    return res.status(201).json({ label: created.rows[0] });
  }
);

/**
 * GET /api/orgs/:orgId/labels
 * Lists labels in an org.
 */
labelsRouter.get(
  "/orgs/:orgId/labels",
  requireAuth,
  requireOrgMember,
  async (req: AuthedRequest, res) => {
    const orgId = req.params.orgId;

    const result = await pool.query(
      `select id, org_id as "orgId", name, created_at as "createdAt"
       from labels
       where org_id = $1
       order by name asc`,
      [orgId]
    );

    return res.json({ labels: result.rows });
  }
);

/**
 * PUT /api/tasks/:taskId/labels
 * Body: { labelIds: string[] }
 *
 * Sets the full label list for a task.
 */
labelsRouter.put(
  "/tasks/:taskId/labels",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const taskId = req.params.taskId;

    const schema = z.object({ labelIds: z.array(z.string()).max(20) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    const t = await pool.query(
      `select org_id as "orgId" from tasks where id = $1`,
      [taskId]
    );
    if (!t.rowCount) return res.status(404).json({ error: "Task not found" });

    const orgId = t.rows[0].orgId;

    const member = await pool.query(
      `select 1 from memberships where org_id = $1 and user_id = $2`,
      [orgId, userId]
    );
    if (!member.rowCount) return res.status(403).json({ error: "Forbidden" });

    const labelIds = Array.from(new Set(parsed.data.labelIds));

    if (labelIds.length > 0) {
      const valid = await pool.query(
        `select id from labels where org_id = $1 and id = any($2::text[])`,
        [orgId, labelIds]
      );
      if (valid.rowCount !== labelIds.length) {
        return res.status(400).json({ error: "One or more labels are invalid for this organization" });
      }
    }

    await pool.query(`delete from task_labels where task_id = $1`, [taskId]);

    for (const labelId of labelIds) {
      await pool.query(
        `insert into task_labels (task_id, label_id) values ($1, $2) on conflict do nothing`,
        [taskId, labelId]
      );
    }

    return res.json({ ok: true, taskId, labelIds });
  }
);
