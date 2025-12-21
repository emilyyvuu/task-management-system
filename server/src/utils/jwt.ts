import jwt from "jsonwebtoken";

export type JwtUser = { userId: string };

export function signAccessToken(payload: JwtUser) {
  const secret = process.env.JWT_ACCESS_SECRET!;
  return jwt.sign(payload, secret, { expiresIn: "15m" });
}

export function verifyAccessToken(token: string) {
  const secret = process.env.JWT_ACCESS_SECRET!;
  return jwt.verify(token, secret) as JwtUser;
}