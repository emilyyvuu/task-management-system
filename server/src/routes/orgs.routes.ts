import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { newId } from "../utils/ids";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";

export const orgsRouter = Router();

/**
 * POST /api/orgs
 * Create an organization. The creator becomes ADMIN.
 */
orgsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    name: z.string().min(1)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const orgId = newId();
  const userId = req.user!.id;
  const { name } = parsed.data;

  // Create org
  await pool.query(
    "insert into organizations (id, name) values ($1, $2)",
    [orgId, name]
  );

  // Make creator ADMIN
  await pool.query(
    `insert into memberships (id, org_id, user_id, role)
     values ($1, $2, $3, 'ADMIN')`,
    [newId(), orgId, userId]
  );

  return res.status(201).json({
    organization: { id: orgId, name }
  });
});

/**
 * GET /api/orgs
 * List organizations the current user belongs to
 */
orgsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;

  const result = await pool.query(
    `
    select
      o.id,
      o.name,
      m.role
    from memberships m
    join organizations o on o.id = m.org_id
    where m.user_id = $1
    order by o.created_at asc
    `,
    [userId]
  );

  return res.json({ organizations: result.rows });
});
