/**
 * Copia de seguridad automática semanal de toda la base de datos (Firestore)
 * a un bucket privado de Cloud Storage (gs://bot-para-peluqueria-backups),
 * separado del proyecto en sí — si algún día pasara algo grave (borrado
 * accidental, un bug que corrompe datos), se puede restaurar desde ahí. El
 * bucket tiene una regla propia que borra sola cualquier copia de más de 60
 * días, para no acumular costo de almacenamiento sin límite (se probó una
 * copia real antes de automatizar esto: terminó bien y el archivo apareció
 * en el bucket).
 *
 * Cómo restaurar si alguna vez hace falta (es un trámite manual a
 * propósito — restaurar PISA los datos actuales, no es algo para hacer sin
 * querer):
 *   1. Elegir la fecha de la copia a restaurar (carpetas con formato
 *      YYYY-MM-DD dentro del bucket — se pueden ver en
 *      https://console.cloud.google.com/storage/browser/bot-para-peluqueria-backups).
 *   2. Correr (con la CLI de gcloud autenticada en la cuenta del proyecto):
 *        gcloud firestore import gs://bot-para-peluqueria-backups/<fecha> --project=bot-para-peluqueria
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { GoogleAuth } from 'google-auth-library';

const BACKUP_BUCKET = 'gs://bot-para-peluqueria-backups';

export const backupFirestore = onSchedule({ schedule: '17 3 * * 0', timeZone: 'Asia/Jerusalem' }, async () => {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/datastore'] });
  const client = await auth.getClient();
  const dateStr = new Date().toISOString().slice(0, 10);

  await client.request({
    url: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments`,
    method: 'POST',
    data: { outputUriPrefix: `${BACKUP_BUCKET}/${dateStr}` },
  });
});
