import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { newId } from "../utils/ids";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { requireOrgMember } from "../middleware/requireOrgMember";

export const projectsRouter = Router();

/**
 * POST /api/orgs/:orgId/projects
 * Create a project in an org.
 * Automatically creates default columns:
 * Backlog (0), In Progress (1), Done (2)
 */
projectsRouter.post(
  "/orgs/:orgId/projects",
  requireAuth,
  requireOrgMember,
  async (req: AuthedRequest, res) => {
    const schema = z.object({ name: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const orgId = req.params.orgId;
    const projectId = newId();
    const { name } = parsed.data;

    await pool.query(
      "insert into projects (id, org_id, name) values ($1, $2, $3)",
      [projectId, orgId, name]
    );

    const columns = [
      { name: "Backlog", position: 0 },
      { name: "In Progress", position: 1 },
      { name: "Done", position: 2 }
    ];

    for (const col of columns) {
      await pool.query(
        "insert into columns (id, org_id, project_id, name, position) values ($1, $2, $3, $4, $5)",
        [newId(), orgId, projectId, col.name, col.position]
      );
    }

    return res.status(201).json({ project: { id: projectId, orgId, name } });
  }
);

/**
 * GET /api/orgs/:orgId/projects
 * List projects for an org (member only). Ordered by creation time.
 */
projectsRouter.get(
  "/orgs/:orgId/projects",
  requireAuth,
  requireOrgMember,
  async (req: AuthedRequest, res) => {
    const orgId = req.params.orgId;

    const result = await pool.query(
      "select id, org_id as \"orgId\", name, created_at as \"createdAt\" from projects where org_id = $1 order by created_at asc",
      [orgId]
    );

    return res.json({ projects: result.rows });
  }
);

/**
 * GET /api/projects/:projectId/board
 * Get board for a project. Fetches columns + tasks.
 *
 * Membership check here happens by finding the project's org_id,
 * then verifying the user is in that org.
 */
projectsRouter.get(
  "/projects/:projectId/board",
  requireAuth,
  async (req: AuthedRequest, res) => {
    const projectId = req.params.projectId;
    const userId = req.user!.id;

    const proj = await pool.query(
      "select id, org_id as \"orgId\" from projects where id = $1",
      [projectId]
    );
    if (!proj.rowCount) return res.status(404).json({ error: "Project not found" });

    const orgId = proj.rows[0].orgId;

    const member = await pool.query(
      "select 1 from memberships where org_id = $1 and user_id = $2",
      [orgId, userId]
    );
    if (!member.rowCount) return res.status(403).json({ error: "Forbidden" });

    const cols = await pool.query(
      `select id, name, position
       from columns
       where project_id = $1
       order by position asc`,
      [projectId]
    );

    const tasks = await pool.query(
    `select
        id,
        column_id as "columnId",
        title,
        description,
        priority,
        due_date as "dueDate",
        assignee_user_id as "assigneeUserId",
        created_at as "createdAt",
        updated_at as "updatedAt"
    from tasks
    where project_id = $1
    order by created_at asc`,
    [projectId]
    );
    
    const tasksByColumnId = new Map<string, any[]>();
    for (const t of tasks.rows) {
    const arr = tasksByColumnId.get(t.columnId) ?? [];
    arr.push(t);
    tasksByColumnId.set(t.columnId, arr);
    }

    return res.json({
    columns: cols.rows.map((c) => ({
        id: c.id,
        name: c.name,
        tasks: tasksByColumnId.get(c.id) ?? []
    }))
    });

  }
);
