import { Router } from "express";
import { pool } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";

export const orgMeRouter = Router();

/**
 * GET /api/orgs/:orgId/me
 * Returns your role + membershipId in this org.
 */
orgMeRouter.get("/orgs/:orgId/me", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const orgId = req.params.orgId;

  const result = await pool.query(
    `select id as "membershipId", role
     from memberships
     where org_id = $1 and user_id = $2`,
    [orgId, userId]
  );

  if (!result.rowCount) return res.status(403).json({ error: "Forbidden" });

  return res.json({ orgId, ...result.rows[0] });
});

/**
 * DELETE /api/orgs/:orgId/me
 * Leave an organization.
 */
orgMeRouter.delete("/orgs/:orgId/me", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const orgId = req.params.orgId;

  const result = await pool.query(
    `select id, role
     from memberships
     where org_id = $1 and user_id = $2`,
    [orgId, userId]
  );

  if (!result.rowCount) return res.status(403).json({ error: "Forbidden" });

  const membership = result.rows[0];

  if (membership.role === "ADMIN") {
    const admins = await pool.query(
      `select count(*)::int as count from memberships where org_id = $1 and role = 'ADMIN'`,
      [orgId]
    );
    if (admins.rows[0].count <= 1) {
      return res.status(400).json({ error: "Cannot leave as the last admin" });
    }
  }

  await pool.query(`delete from memberships where id = $1`, [membership.id]);
  return res.status(204).send();
});
