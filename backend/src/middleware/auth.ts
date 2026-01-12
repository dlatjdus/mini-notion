// JWT accessToken 검증 미들웨어
// 미들웨어: 요청을 가로채서 인증을 거침(통과/ 중단, 응답)


import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../auth";

// 요청 객체에 userId 붙이기 위한 타입
export type AuthedRequest = Request & {
  userId?: number;
};

// Bearer 토큰 파싱
function getBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth) return null;
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  return token.length ? token : null;
}

// 보호 미들웨어
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ message: "No access token" });

    console.log("JWT_ACCESS_SECRET exists?", !!process.env.JWT_ACCESS_SECRET);
    console.log("Authorization header:", req.headers.authorization);


  try {
    const decoded = verifyAccessToken(token); // TokenPayload { userId }
    req.userId = decoded.userId;
    return next();
  } catch (e) {
    return res.status(401).json({ 
        message: "Access token invalid/expired",
        detail: e instanceof Error ? e.message : String(e),
     });
  }
}

