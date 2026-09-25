/**
 * Rutas de invitaciones (Fase 4).
 * POST /api/invitations/accept
 */
import { Router, Request, Response, NextFunction } from "express";

import { createAuthStore } from "../db/authStore.js";
import { createStore } from "../db/processStore.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
const authStore = createAuthStore();
const processStore = createStore();

/** POST /api/invitations/accept */
router.post("/accept", authRequired, (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body as { token?: string };
    if (!token) return res.status(400).json({ error: "Token obligatorio" });

    // Buscar invitación por token
    const invitation = authStore.findInvitationByToken(token);
    if (!invitation) return res.status(400).json({ error: "Invitación inválida o expirada" });

    // Verificar que el usuario autenticado coincida con el email de la invitación
    const authUser = req.user!;
    if (authUser.email !== invitation.email) {
      return res.status(403).json({ error: "Esta invitación es para otro usuario" });
    }

    // Crear colaborador
    const collaborator = processStore.addCollaborator(authUser.id, invitation.processId, authUser.id, invitation.role as "editor" | "viewer");

    // Invalidar invitación
    authStore.invalidateInvitation(invitation.id);

    res.json({ collaborator });
  } catch (e) {
    next(e);
  }
});

export { router as invitationsRouter };