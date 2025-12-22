import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { newId } from "../utils/ids";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import { requireOrgAdmin } from "../middleware/requireOrgAdmin";
import { generateInviteToken, hashInviteToken, inviteExpiresAt } from "../utils/invites";

export const invitesRouter = Router();

/**
 * POST /api/orgs/:orgId/invites (ADMIN only)
 * Creates an invite and returns a token (demo: return link)
 */
invitesRouter.post("/orgs/:orgId/invites", requireAuth, requireOrgAdmin, async (req: AuthedRequest, res) => {
  const orgId = req.params.orgId;

  const schema = z.object({
    email: z.string().email(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const { email } = parsed.data;

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = inviteExpiresAt(7);

  await pool.query(
    `insert into invites (id, org_id, email, token_hash, expires_at)
     values ($1, $2, $3, $4, $5)`,
    [newId(), orgId, email.toLowerCase(), tokenHash, expiresAt]
  );

  // For demo: return the token (or link). In production you email it.
  const inviteLink = `${process.env.WEB_ORIGIN ?? "http://localhost:5173"}/accept-invite?token=${token}`;

  return res.status(201).json({
    invite: {
      email,
      expiresAt,
      inviteLink,
      token, // include for demo/testing
    },
  });
});

/**
 * POST /api/invites/accept
 * User must be logged in (so we know who is accepting)
 */
invitesRouter.post("/invites/accept", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;

  const schema = z.object({
    token: z.string().min(10),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { token } = parsed.data;
  const tokenHash = hashInviteToken(token);

  const found = await pool.query(
    `select id, org_id as "orgId", email, expires_at as "expiresAt", accepted_at as "acceptedAt"
     from invites
     where token_hash = $1`,
    [tokenHash]
  );

  if (!found.rowCount) return res.status(400).json({ error: "Invalid invite token" });

  const invite = found.rows[0];

  if (invite.acceptedAt) return res.status(400).json({ error: "Invite already used" });
  if (new Date(invite.expiresAt).getTime() <= Date.now()) return res.status(400).json({ error: "Invite expired" });

  // Ensure the accepting user's email matches invite email
  const user = await pool.query("select email from users where id = $1", [userId]);
  if (!user.rowCount) return res.status(404).json({ error: "User not found" });

  const userEmail = String(user.rows[0].email).toLowerCase();
  if (userEmail !== String(invite.email).toLowerCase()) {
    return res.status(403).json({ error: "This invite was sent to a different email" });
  }

  const existing = await pool.query(
    "select id from memberships where org_id = $1 and user_id = $2",
    [invite.orgId, userId]
  );

  if (!existing.rowCount) {
    await pool.query(
      `insert into memberships (id, org_id, user_id, role)
       values ($1, $2, $3, 'MEMBER')`,
      [newId(), invite.orgId, userId]
    );
  }

  // Mark invite accepted
  await pool.query(`update invites set accepted_at = now() where id = $1`, [invite.id]);

  return res.json({ ok: true, orgId: invite.orgId });
});