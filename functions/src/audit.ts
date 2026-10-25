import { getAuth } from 'firebase-admin/auth';
import { db } from './admin';

export type AuditAction =
  | 'appointment_created'
  | 'appointment_cancelled'
  | 'appointment_marked_no_show'
  | 'appointment_marked_completed'
  | 'appointment_confirmed'
  | 'subscription_cancelled';

/**
 * Deja constancia de quién hizo una acción sensible desde el panel y cuándo
 * ("Registro de auditoría" pedido por el usuario). Solo cubre las acciones
 * que ya pasan por una Cloud Function con sesión verificada (altas/bajas/
 * cambios de estado de citas, cancelar la suscripción) — son las más
 * consecuentes (afectan el calendario o el dinero). Las pantallas que
 * escriben directo a Firestore desde la app (Horarios, Sucursales,
 * Servicios, Campañas, Ajustes generales) todavía no quedan registradas acá
 * — habría que pasarlas por una Cloud Function para poder confiar en quién
 * hizo el cambio, que es un trabajo aparte más grande.
 *
 * `auditLog` es de solo lectura desde el cliente (firestore.rules): solo
 * este código, con el SDK de administrador, puede escribir — así nadie
 * puede borrar ni falsificar su propio rastro.
 */
export async function logAudit(uid: string, branchId: string, action: AuditAction, details: Record<string, unknown> = {}): Promise<void> {
  try {
    let email = uid;
    try {
      email = (await getAuth().getUser(uid)).email ?? uid;
    } catch {
      // Sigue con el uid como identificador si no se pudo resolver el mail.
    }
    const ref = db.collection('auditLog').doc();
    await ref.set({ id: ref.id, branchId, uid, email, action, details, createdAt: Date.now() });
  } catch (err) {
    // El registro de auditoría nunca debe romper la acción real (cancelar/
    // confirmar una cita) si falla por algún motivo — solo se deja en los
    // logs de Cloud Functions.
    console.error('[audit] error guardando', err);
  }
}
