import { Response, NextFunction } from "express";
import { pool } from "../db";
import { AuthedRequest } from "./requireAuth";

export async function requireOrgMember(req: AuthedRequest, res: Response, next: NextFunction) {
  const orgId = req.params.orgId;
  const userId = req.user?.id;

  if (!orgId) return res.status(400).json({ error: "Missing orgId in route params" });
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const result = await pool.query(
    "select role from memberships where org_id = $1 and user_id = $2",
    [orgId, userId]
  );

  if (!result.rowCount) {
    return res.status(403).json({ error: "You are not a member of this organization" });
  }

  (req as any).orgRole = result.rows[0].role;
  next();
}
