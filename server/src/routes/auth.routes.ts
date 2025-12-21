import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { newId } from "../utils/ids";
import { hashPassword, verifyPassword } from "../utils/password";
import { signAccessToken } from "../utils/jwt";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

authRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;

  const existing = await pool.query("select id from users where email = $1", [email]);
  if (existing.rowCount && existing.rowCount > 0) {
    return res.status(409).json({ error: "Email already in use" });
  }

  const userId = newId();
  const passwordHash = await hashPassword(password);

  await pool.query(
    "insert into users (id, email, password_hash) values ($1, $2, $3)",
    [userId, email, passwordHash]
  );

  const accessToken = signAccessToken({ userId });

  return res.status(201).json({
    user: { id: userId, email },
    accessToken
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;

  const result = await pool.query(
    "select id, password_hash from users where email = $1",
    [email]
  );

  if (!result.rowCount) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const user = result.rows[0];
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const accessToken = signAccessToken({ userId: user.id });

  return res.json({
    user: { id: user.id, email },
    accessToken
  });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;

  const result = await pool.query("select id, email, created_at from users where id = $1", [userId]);
  if (!result.rowCount) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({ user: result.rows[0] });
});
