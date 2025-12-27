import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { newId } from "../utils/ids";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiresAt,
} from "../utils/tokens";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";
import type { CookieOptions } from "express";

export const authRouter = Router();

function getRefreshCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/api/auth/refresh",
  };
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

/**
 * POST /api/auth/signup
 * Creates a new user and returns an access token.
 */
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

/**
 * POST /api/auth/login
 * Logs in a user and returns an access token + sets refresh token cookie.
 */
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

  
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = refreshExpiresAt();

  // store refresh token hash in DB
  await pool.query(
    `insert into refresh_tokens (id, user_id, token_hash, expires_at)
    values ($1, $2, $3, $4)`,
    [newId(), user.id, refreshTokenHash, expiresAt]
  );

  // set cookie with raw refresh token
  res.cookie(process.env.REFRESH_COOKIE_NAME ?? "refresh_token", refreshToken, {
    ...getRefreshCookieOptions(),
    expires: expiresAt,
  });

  const accessToken = signAccessToken({ userId: user.id });

  return res.json({
    user: { id: user.id, email },
    accessToken
  });
});

/**
 * GET /api/auth/me
 * Returns the authenticated user's info.
 */
authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;

  const result = await pool.query("select id, email, created_at from users where id = $1", [userId]);
  if (!result.rowCount) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({ user: result.rows[0] });
});

/**
 * POST /api/auth/refresh
 * Uses the refresh token cookie to issue a new access token.
 */
authRouter.post("/refresh", async (req, res) => {
  const cookieName = process.env.REFRESH_COOKIE_NAME ?? "refresh_token";
  const raw = req.cookies?.[cookieName];

  if (!raw) return res.status(401).json({ error: "Missing refresh token" });

  const tokenHash = hashRefreshToken(raw);

  const found = await pool.query(
    `select id, user_id as "userId", revoked_at as "revokedAt", expires_at as "expiresAt"
     from refresh_tokens
     where token_hash = $1`,
    [tokenHash]
  );

  if (!found.rowCount) return res.status(401).json({ error: "Invalid refresh token" });

  const row = found.rows[0];

  if (row.revokedAt) return res.status(401).json({ error: "Refresh token revoked" });
  if (new Date(row.expiresAt).getTime() <= Date.now()) return res.status(401).json({ error: "Refresh token expired" });

  await pool.query(`update refresh_tokens set revoked_at = now() where id = $1`, [row.id]);

  const newRefresh = generateRefreshToken();
  const newHash = hashRefreshToken(newRefresh);
  const newExpiresAt = refreshExpiresAt();

  await pool.query(
    `insert into refresh_tokens (id, user_id, token_hash, expires_at)
     values ($1, $2, $3, $4)`,
    [newId(), row.userId, newHash, newExpiresAt]
  );

  res.cookie(cookieName, newRefresh, {
    ...getRefreshCookieOptions(),
    expires: newExpiresAt,
  });

  const newAccessToken = signAccessToken({ userId: row.userId });

  return res.json({ accessToken: newAccessToken });
});

/**
 * POST /api/auth/logout
 * Revokes the current refresh token and clears the cookie.
 */
authRouter.post("/logout", async (req, res) => {
  const cookieName = process.env.REFRESH_COOKIE_NAME ?? "refresh_token";
  const raw = req.cookies?.[cookieName];

  if (raw) {
    const tokenHash = hashRefreshToken(raw);
    await pool.query(
      `update refresh_tokens set revoked_at = now()
       where token_hash = $1 and revoked_at is null`,
      [tokenHash]
    );
  }

  res.clearCookie(cookieName, getRefreshCookieOptions());
  return res.json({ ok: true });
});

