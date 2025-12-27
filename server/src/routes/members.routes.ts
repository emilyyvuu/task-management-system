import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { requireOrgMember } from "../middleware/requireOrgMember";
import { requireOrgAdmin } from "../middleware/requireOrgAdmin";

export const membersRouter = Router();

/**
 * GET /api/orgs/:orgId/members 
 * List members of an org.
 */
membersRouter.get(
  "/orgs/:orgId/members",
  requireAuth,
  requireOrgMember,
  async (req: AuthedRequest, res) => {
    const orgId = req.params.orgId;

    const result = await pool.query(
      `
      select
        m.id as "membershipId",
        m.role,
        m.created_at as "joinedAt",
        u.id as "userId",
        u.email
      from memberships m
      join users u on u.id = m.user_id
      where m.org_id = $1
      order by m.created_at asc
      `,
      [orgId]
    );

    return res.json({ members: result.rows });
  }
);

/**
 * PATCH /api/orgs/:orgId/members/:memberId (ADMIN only)
 * Changes role of a membership.
 */
membersRouter.patch(
  "/orgs/:orgId/members/:memberId",
  requireAuth,
  requireOrgAdmin,
  async (req: AuthedRequest, res) => {
    const orgId = req.params.orgId;
    const memberId = req.params.memberId;

    const schema = z.object({ role: z.enum(["ADMIN", "MEMBER"]) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    // don't demote the last admin
    if (parsed.data.role === "MEMBER") {
      const current = await pool.query(
        `select user_id as "userId", role from memberships where id = $1 and org_id = $2`,
        [memberId, orgId]
      );
      if (!current.rowCount) return res.status(404).json({ error: "Member not found" });

      if (current.rows[0].role === "ADMIN") {
        const admins = await pool.query(
          `select count(*)::int as count from memberships where org_id = $1 and role = 'ADMIN'`,
          [orgId]
        );
        if (admins.rows[0].count <= 1) {
          return res.status(400).json({ error: "Cannot demote the last admin" });
        }
      }
    }

    const updated = await pool.query(
      `
      update memberships
      set role = $1
      where id = $2 and org_id = $3
      returning id as "membershipId", org_id as "orgId", user_id as "userId", role
      `,
      [parsed.data.role, memberId, orgId]
    );

    if (!updated.rowCount) return res.status(404).json({ error: "Member not found" });
    return res.json({ member: updated.rows[0] });
  }
);

/**
 * DELETE /api/orgs/:orgId/members/:memberId (ADMIN only)
 * Removes a member from org.
 */
membersRouter.delete(
  "/orgs/:orgId/members/:memberId",
  requireAuth,
  requireOrgAdmin,
  async (req: AuthedRequest, res) => {
    const orgId = req.params.orgId;
    const memberId = req.params.memberId;

    const member = await pool.query(
      `select user_id as "userId", role from memberships where id = $1 and org_id = $2`,
      [memberId, orgId]
    );
    if (!member.rowCount) return res.status(404).json({ error: "Member not found" });

    // don't remove the last admin
    if (member.rows[0].role === "ADMIN") {
      const admins = await pool.query(
        `select count(*)::int as count from memberships where org_id = $1 and role = 'ADMIN'`,
        [orgId]
      );
      if (admins.rows[0].count <= 1) {
        return res.status(400).json({ error: "Cannot remove the last admin" });
      }
    }

    await pool.query(`delete from memberships where id = $1 and org_id = $2`, [memberId, orgId]);
    return res.status(204).send();
  }
);