import "dotenv/config";
import path from "path";
import fs from "fs";
import multer from "multer";

import express, { type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

import { pool } from "./db";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./auth";
import { requireAuth, type AuthedRequest } from "./middleware/auth";

type CookiesRequest = Request & {
  cookies?: {
    refreshToken?: string;
  };
};

const app = express();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    credentials: true, // 쿠키 주고받기 위해 필수
  })
);

// ==== uploads 폴더 준비 + 정적 서빙 ====
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
app.use("/uploads", express.static(UPLOAD_DIR));

// ==== multer 설정
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.\-]+/g, "_");
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}_${safeName}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024}, // 5MB
})

// ===== 공용 유틸 =====
function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // 배포(https)면 true
    sameSite: "lax",
    path: "/",
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie("refreshToken", { path: "/" });
}

// ===== 기본 확인 =====
app.get("/health", (_req: Request, res: Response) => res.json({ ok: true }));

app.get("/db-health", async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS one");
    res.json({ ok: true, rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ===== 인증 필요: 내 정보 =====
app.get("/me", requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const [rows] = await pool.query<any[]>(
    "SELECT id, email, name, picture_url AS pictureUrl FROM users WHERE id=?",
    [userId]
  );

  if (!rows || rows.length === 0) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.json({ user: rows[0] });
});

// ===== (1) 구글 로그인 → 우리 JWT 발급 =====
app.post("/auth/google", async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken) return res.status(400).json({ message: "idToken required" });

    // 1) 구글 ID 토큰 검증
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();
    if (!p?.sub) {
      return res.status(401).json({ message: "Invalid Google token payload" });
    }

    const googleSub = p.sub;
    const email = p.email ?? null;
    const name = p.name ?? null;
    const picture = p.picture ?? null;

    // 2) users upsert (트랜잭션)
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [existing] = await conn.query<any[]>(
        "SELECT id FROM users WHERE google_sub=? LIMIT 1",
        [googleSub]
      );

      let userId: number;

      if (!existing || existing.length === 0) {
        const [r] = await conn.query<any>(
          "INSERT INTO users (google_sub, email, name, picture_url) VALUES (?,?,?,?)",
          [googleSub, email, name, picture]
        );
        userId = r.insertId as number;
      } else {
        userId = existing[0].id as number;
        await conn.query(
          "UPDATE users SET email=?, name=?, picture_url=? WHERE id=?",
          [email, name, picture, userId]
        );
      }

      // 3) 우리 JWT 발급
      const accessToken = signAccessToken({ userId });
      const refreshToken = signRefreshToken({ userId });

      // refresh는 DB에는 해시로 저장
      const tokenHash = sha256(refreshToken);
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      await conn.query(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)",
        [userId, tokenHash, expiresAt]
      );

      await conn.commit();

      // 4) refresh는 쿠키
      setRefreshCookie(res, refreshToken);

      // 5) access는 body
      return res.json({
        accessToken,
        user: { id: userId, email, name, pictureUrl: picture },
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    return res
      .status(401)
      .json({ message: "Google auth failed", detail: String(e) });
  }
});

// ===== (2) refresh → access 재발급 =====
app.post("/auth/refresh", async (req: CookiesRequest, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: "No refresh token" });

    const decoded = verifyRefreshToken(refreshToken) as { userId: number };
    const userId = decoded.userId;

    const tokenHash = sha256(refreshToken);
    const [rows] = await pool.query<any[]>(
      "SELECT id FROM refresh_tokens WHERE user_id=? AND token_hash=? AND expires_at > NOW() LIMIT 1",
      [userId, tokenHash]
    );
    if (!rows || rows.length === 0) {
      return res.status(401).json({ message: "Refresh invalid" });
    }

    const newAccessToken = signAccessToken({ userId });
    return res.json({ accessToken: newAccessToken });
  } catch {
    return res.status(401).json({ message: "Refresh failed" });
  }
});

// ===== (3) 로그아웃 =====
app.post("/auth/logout", async (req: CookiesRequest, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;

  try {
    if (refreshToken) {
      await pool.query("DELETE FROM refresh_tokens WHERE token_hash=?", [
        sha256(refreshToken),
      ]);
    }
  } catch {
    // 로그아웃은 DB 삭제 실패해도 쿠키 지우고 OK로 처리하는 경우가 많음
  }

  clearRefreshCookie(res);
  return res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Backend running: http://localhost:${port}`);
});

// GET/pages: 내 페이지 목록
app.get("/pages", requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;

  const [rows] = await pool.query<any[]>(
    "SELECT id, title, updated_at AS updatedAt FROM pages WHERE user_id=? ORDER BY updated_at DESC",
    [userId]
  );

  return res.json({ pages: rows });
})


// POST/pages: 새 페이지 생성(title 필수)
app.post("/pages", requireAuth, async(req: AuthedRequest, res: Response) => {
  console.log("headers content-type:", req.headers["content-type"]);
  console.log("POST /pages body:", req.body);


  const userId = req.userId!;
  const { title, content } = (req.body ?? {}) as { title?: string; content?: string };

  // title NOT NULL이라서 서버에서 기본값 강제로 넣어줌
  const safeTitle = (title ?? "Untitled").trim() || "Untitled";
  const safeContent = content ?? "";

  const [r] = await pool.query<any>(
    "INSERT INTO pages (user_id, title, content) VALUES (?,?,?)",
    [userId, safeTitle, safeContent]
  );

  return res.status(201).json({ id: r.insertId });
})

// GET/pages/:id : 페이지 1개 조회
app.get("/pages/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const pageId = Number(req.params.id);

  if (!Number.isFinite(pageId)) {
    return res.status(400).json({ message: "Invalid page id" });
  }

  const [rows] = await pool.query<any[]>(
    "SELECT id, user_id AS userId, title, content, created_at AS createdAt, updated_at AS updatedAt FROM pages WHERE id=? AND user_id=? LIMIT 1",
    [pageId, userId]
  );

  if (rows.length === 0) {
    return res.status(404).json({ message: "Page not found" });
  }

  return res.json({ page: rows[0] });
});

// PUT /pages/:id : 제목, 내용 수정(자동저장용)
app.put("/pages/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const pageId = Number(req.params.id);

  if (!Number.isFinite(pageId)) {
    return res.status(400).json({ message: "Invalid page id" });
  }

  const { title, content } = req.body as { title?: string; content?: string };

  if (title === undefined && content === undefined) {
    return res.status(400).json({ message: "Nothing to update" });
  }

  // title이 빈 문자열로 오면 NOT NULL은 되지만 UX상 막는 게 좋음
  const nextTitle = title !== undefined ? (title.trim() || "Untitled") : null;

  const [result] = await pool.query<any>(
    "UPDATE pages SET title=COALESCE(?, title), content=COALESCE(?, content), updated_at=NOW() WHERE id=? AND user_id=?",
    [nextTitle, content ?? null, pageId, userId]
  );

  if (!result || result.affectedRows === 0) {
    return res.status(404).json({ message: "Page not found" });
  }

  return res.json({ ok: true });
});

// DELETE /pages/:id 삭제
app.delete("/pages/:id", requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const pageId = Number(req.params.id);

  if (!Number.isFinite(pageId)) {
    return res.status(400).json({ message: "Invalid page id" });
  }

  const [result] = await pool.query<any>(
    "DELETE FROM pages WHERE id=? AND user_id=?",
    [pageId, userId]
  );

  if (!result || result.affectedRows === 0) {
    return res.status(404).json({ message: "Page not found" });
  }

  return res.json({ ok: true });
});

// POST /pages/:id/images
app.post(
  "/pages/:id/images",
  requireAuth,
  upload.single("image"),
  async (req: AuthedRequest, res: Response) => {
    const userId = req.userId!;
    const pageId = Number(req.params.id);

    if (!Number.isFinite(pageId)) {
      return res.status(400).json({ message: "Invalid page id" });
    }

    const [p] = await pool.query<any[]>(
      "SELECT id FROM pages WHERE id=? AND user_id=? LIMIT 1",
      [pageId, userId]
    );
    if (!p || p.length === 0) {
      return res.status(404).json({ message: "Page not found" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "image file required" });
    }

    const url = `/uploads/${req.file.filename}`;

    const [r] = await pool.query<any>(
      `INSERT INTO page_images
       (page_id, user_id, url, filename, original_name, mime_type, size_bytes)
       VALUES (?,?,?,?,?,?,?)`,
      [
        pageId,
        userId,
        url,
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
      ]
    );

    // INSERT 성공 시 updated_at 수정
    await pool.query(
      "UPDATE pages SET updated_at = NOW() WHERE id = ? AND user_id = ?",
      [pageId, userId]
    );

    return res.status(201).json({
      image: {
        id: r.insertId,
        url,
        originalName: req.file.originalname,
      },
    });
  }
);

// GET /pages/:id/images
app.get("/pages/:id/images", requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.userId!;
  const pageId = Number(req.params.id);

  if (!Number.isFinite(pageId)) {
    return res.status(400).json({ message: "Invalid page id" });
  }

  const [rows] = await pool.query<any[]>(
    `SELECT id, url, original_name AS originalName, created_at AS createdAt
     FROM page_images
     WHERE page_id=? AND user_id=?
     ORDER BY created_at ASC`,
    [pageId, userId]
  );

  return res.json({ images: rows });
});

// DELETE /pages/:pageId/images/:imageId
app.delete(
  "/pages/:pageId/images/:imageId",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const userId = req.userId!;
    const pageId = Number(req.params.pageId);
    const imageId = Number(req.params.imageId);

    if (!Number.isFinite(pageId) || !Number.isFinite(imageId)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    // 이미지가 이 페이지 + 이 유저 소유인지 확인
    const [rows] = await pool.query<any[]>(
      `SELECT filename
       FROM page_images
       WHERE id=? AND page_id=? AND user_id=?
       LIMIT 1`,
      [imageId, pageId, userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Image not found" });
    }

    const filename = rows[0].filename;
    const filePath = path.join(UPLOAD_DIR, filename);

    // DB 삭제
    await pool.query(
      "DELETE FROM page_images WHERE id=? AND page_id=? AND user_id=?",
      [imageId, pageId, userId]
    );

    // DELETE 성공 시, updated_at 수정
    await pool.query(
      "UPDATE pages SET updated_at = NOW() WHERE id = ? AND user_id = ?",
      [pageId, userId]
    );

    // 실제 파일 삭제 (실패해도 DB는 유지)
    fs.unlink(filePath, (err) => {
      if (err) {
        console.warn("file delete failed:", err.message);
      }
    });

    return res.json({ ok: true });
  }
);

