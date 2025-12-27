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