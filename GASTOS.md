# Gastos mensuales del sistema

Costo de mantener Citas Peluquería funcionando (infraestructura técnica,
no los gastos del negocio de la peluquería en sí — esos se cargan en la
pantalla "Finanzas" de la app). Actualizar esta lista cada vez que se
agregue o cambie un servicio pago.

| Servicio | Para qué sirve | Costo | Estado |
|---|---|---|---|
| **Railway** | Hosting del bot de WhatsApp (tiene que estar prendido 24/7) | **$5/mes** (plan elegido por el usuario) | ✅ Activo |
| **Firebase (Blaze)** | Hosting de la app/web, Cloud Functions (motor de reservas), base de datos (Firestore), login | $0 por ahora (dentro del crédito de prueba gratis de Google, ₪891 por 90 días) — después pasa a pago por uso, probablemente bajo con el volumen de una sola peluquería | ✅ Activo |
| **OpenAI (transcripción de audios)** | Que el bot entienda notas de voz de WhatsApp | ~$0.006 por minuto de audio — centavos por mes con este volumen | ✅ Activo |
| **Telnyx** | Línea de teléfono para el IVR (reservas por llamada) | $3 de alta + $3/mes por el número (ya pagado con el saldo cargado, $15) — **pero el número todavía no está activo** (trámite pendiente), así que hoy no está sirviendo todavía | ⏳ Pendiente de activar |
| **Tranzila** | Cobrar la suscripción mensual del sistema con tarjeta (clientes de Israel) | ⬜ Por confirmar — todavía no se creó la cuenta, falta saber el costo/comisión por transacción | ⏳ Sin empezar |
| **Twilio** | (abandonado) | $0 — se pidió reembolso | ❌ Cerrado |
| **Dominio propio** | — | $0 — se está usando el subdominio gratis de Firebase (`...web.app`), no se compró un dominio propio | — |

## Total aproximado hoy
**~$5/mes** (Railway), más centavos de OpenAI. El resto (Firebase, Telnyx,
Tranzila) todavía no suma costo real porque están dentro del crédito
gratis, pendientes de activar, o sin empezar.

## Nota
Esta lista es de la infraestructura técnica (lo que paga quien construye
el sistema). No incluye lo que el peluquero le cobra a sus clientes ni
sus propios gastos del local (alquiler, insumos, etc.) — eso se carga
aparte en la pantalla "Finanzas" de la app.
