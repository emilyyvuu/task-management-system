import crypto from "crypto";
import jwt from "jsonwebtoken";

/**
 * Creates a JWT using the access token secret and a short expiry.
 */
export function signAccessToken(payload: { userId: string }) {
  const secret = process.env.JWT_ACCESS_SECRET!;
  const ttlMin = Number(process.env.ACCESS_TOKEN_TTL_MIN ?? 15);
  return jwt.sign(payload, secret, { expiresIn: `${ttlMin}m` });
}

/**
 * Checks the JWT signature and expiry, then returns the payload (userId).
 */
export function verifyAccessToken(token: string) {
  const secret = process.env.JWT_ACCESS_SECRET!;
  return jwt.verify(token, secret) as { userId: string };
}

/**
 * Generates a new random refresh token. 
 */
export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

/**
 * Hashes the raw refresh token so the DB only stores the hash.
 */
export function hashRefreshToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Calculates the expiry date for a refresh token.
 */
export function refreshExpiresAt() {
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 14);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
