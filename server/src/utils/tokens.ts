import crypto from "crypto";
import jwt from "jsonwebtoken";

export function signAccessToken(payload: { userId: string }) {
  const secret = process.env.JWT_ACCESS_SECRET!;
  const ttlMin = Number(process.env.ACCESS_TOKEN_TTL_MIN ?? 15);
  return jwt.sign(payload, secret, { expiresIn: `${ttlMin}m` });
}

export function verifyAccessToken(token: string) {
  const secret = process.env.JWT_ACCESS_SECRET!;
  return jwt.verify(token, secret) as { userId: string };
}

/**
 * Refresh tokens are random strings.
 * Store only a hash in DB for safety.
 */
export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshExpiresAt() {
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 14);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
