/**
 * Rutas de invitaciones (Fase 4).
 * POST /api/invitations/accept
 * GET  /api/invitations/mine  (invitaciones pendientes dirigidas a mi email)
 */
import { Router, Request, Response, NextFunction } from "express";

import { getAuthStore } from "../db/singleton.js";
import { getProcessStore } from "../db/singleton.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();
const authStore = getAuthStore();
const processStore = getProcessStore();

/** POST /api/invitations/accept */
router.post("/accept", authRequired, (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body as { token?: string };
    if (!token) return res.status(400).json({ error: "Token obligatorio" });

    // La invitación debe estar firmada y viva en la DB.
    const invitation = authStore.findInvitationByToken(token);
    if (!invitation) return res.status(400).json({ error: "Invitación inválida o expirada" });

    // El token identifica al email invitado: solo ese usuario puede aceptarla.
    const authUser = req.user!;
    if (authUser.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return res.status(403).json({
        error: `Esta invitación es para ${invitation.email}. Iniciá sesión con ese email para aceptarla.`,
      });
    }

    // No hace falta validar que el proceso exista: `Invitation.processId` tiene
    // `ON DELETE CASCADE`, así que si el proceso se borró la invitación tampoco está.

    // El owner ya autorizó este alta al emitir la invitación, así que se agrega
    // directo (no pasa por `addCollaborator`, que exige `manage_collaborators`).
    const collaborator = processStore.addCollaboratorDirect(
      invitation.processId,
      authUser.id,
      invitation.role as "editor" | "viewer",
    );

    authStore.invalidateInvitation(invitation.id);

    res.json({ collaborator });
  } catch (e) {
    next(e);
  }
});

/** GET /api/invitations/mine — invitaciones pendientes para mi email. */
router.get("/mine", authRequired, (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = authStore.db
      .prepare("SELECT id, email, processId, role, expiresAt, createdAt FROM Invitation WHERE email = ? ORDER BY createdAt DESC")
      .all(req.user!.email.toLowerCase()) as Array<{
        id: string;
        email: string;
        processId: string;
        role: string;
        expiresAt: string;
        createdAt: string;
      }>;

    // Se devuelve el token también: el usuario ya está autenticado **con ese
    // email**, así que puede aceptar su propia invitación sin backend de email.
    const invitations = rows.map((row) => ({
      ...row,
      token:
        (authStore.db
          .prepare("SELECT token FROM Invitation WHERE id = ?")
          .get(row.id) as { token: string } | undefined)?.token ?? "",
      processName: processStore.getMeta(req.user!.id, row.processId)?.name ?? "(proceso eliminado)",
      alreadyAccepted: processStore.roleOf(req.user!.id, row.processId) !== null,
    }));

    res.json(invitations);
  } catch (e) {
    next(e);
  }
});

export { router as invitationsRouter };
