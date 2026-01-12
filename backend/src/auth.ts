// JWT 유틸

import jwt, { type JwtPayload } from "jsonwebtoken";

export type TokenPayload = {
  userId: number;
};

export function signAccessToken(payload: TokenPayload): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is missing");
  return jwt.sign(payload, secret, { expiresIn: "15m" });
}

export function signRefreshToken(payload: TokenPayload): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET is missing");
  return jwt.sign(payload, secret, { expiresIn: "14d" });
}

export function verifyAccessToken(token: string): TokenPayload {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is missing");

  const decoded = jwt.verify(token, secret);
  if (typeof decoded === "string") throw new Error("Invalid access token payload");
  return decoded as JwtPayload as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET is missing");

  const decoded = jwt.verify(token, secret);
  if (typeof decoded === "string") throw new Error("Invalid refresh token payload");
  return decoded as JwtPayload as TokenPayload;
}
