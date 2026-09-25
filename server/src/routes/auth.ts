/**
 * Rutas de autenticación (Fase 4).
 * POST /register, POST /login, POST /refresh, GET /me, PUT /me
 */
import { Router, Request, Response, NextFunction } from "express";

import { createAuthStore } from "../db/authStore.js";
import { authRequired } from "../middleware/auth.js";
import { validateRegister, validateLogin } from "@shared/validation/validateAuth.js";

const router = Router();
const authStore = createAuthStore();

/** Helper: setea cookie httpOnly para refresh token. */
function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    path: "/",
  });
}

/** Helper: limpia cookie refresh. */
function clearRefreshCookie(res: Response): void {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

// --- POST /api/auth/register ---
router.post("/register", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = req.body as { email?: string; password?: string; name?: string };

    const validation = validateRegister({ email: email ?? "", password: password ?? "", name: name ?? "" });
    if (!validation.valid) {
      return res.status(400).json({ error: "Datos inválidos", issues: validation.errors });
    }

    const user = authStore.createUser(email!, password!, name!);
    const tokens = authStore.issueTokens(user);
    setRefreshCookie(res, tokens.refreshToken);

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, createdAt: user.createdAt },
      accessToken: tokens.accessToken,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "EMAIL_EXISTS") {
      return res.status(409).json({ error: "Email ya registrado" });
    }
    next(e);
  }
});

// --- POST /api/auth/login ---
router.post("/login", (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    const validation = validateLogin({ email: email ?? "", password: password ?? "" });
    if (!validation.valid) {
      return res.status(400).json({ error: "Datos inválidos", issues: validation.errors });
    }

    const user = authStore.findByEmail(email!);
    if (!user || !authStore.verifyPassword(user, password!)) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const tokens = authStore.issueTokens(user);
    setRefreshCookie(res, tokens.refreshToken);

    res.json({
      user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, createdAt: user.createdAt },
      accessToken: tokens.accessToken,
    });
  } catch (e) {
    next(e);
  }
});

// --- POST /api/auth/refresh ---
router.post("/refresh", (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: "No hay refresh token" });
    }

    const newTokens = authStore.rotateRefreshToken(refreshToken);
    if (!newTokens) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: "Sesión expirada, inicie sesión de nuevo" });
    }

    setRefreshCookie(res, newTokens.refreshToken);
    res.json({ accessToken: newTokens.accessToken });
  } catch (e) {
    next(e);
  }
});

// --- GET /api/auth/me ---
router.get("/me", authRequired, (_req: Request, res: Response) => {
  res.json({ id: _req.user!.id, email: _req.user!.email, name: _req.user!.name, avatar: null, createdAt: "" });
  // Nota: createdAt y avatar se obtendrían de la DB si hiciera falta; para Fase 4 basta con lo del token
});

// --- PUT /api/auth/me ---
router.put("/me", authRequired, (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, avatar } = req.body as { name?: string; avatar?: string };
    const user = authStore.updateProfile(req.user!.id, name, avatar);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ id: user.id, email: user.email, name: user.name, avatar: user.avatar, createdAt: user.createdAt });
  } catch (e) {
    next(e);
  }
});

// --- POST /api/auth/logout ---
router.post("/logout", authRequired, (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      authStore.revokeRefreshToken(refreshToken);
    }
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export { router as authRouter };