# Changelog

## [2.0.0] - 2026-09-09

### Cambiado
- El proyecto pasa de ser una app de contactos de yeshivot a un **sistema de citas para peluquería** en Israel, con reserva automática por WhatsApp y por teléfono (IVR), pensado para clientes con teléfono kasher.

### Agregado
- Motor de reservas con transacciones de Firestore que impiden doble reserva del mismo peluquero/horario, sin importar si la cita llega por WhatsApp, teléfono o desde la app.
- Bot de WhatsApp (Baileys) con flujo conversacional: agendar, cancelar, ver mis citas, confirmar/cancelar recordatorios ("1"/"2"), reservas recurrentes, y respuesta a ofertas de lista de espera.
- IVR telefónico (Twilio, texto a voz en hebreo) para clientes sin WhatsApp: agendar el próximo hueco libre, cancelar la próxima cita, o transferir a la línea directa.
- Recordatorios automáticos 24h y 2h antes por el canal preferido del cliente (WhatsApp, SMS o llamada).
- Lista de espera: al cancelarse una cita, se ofrece automáticamente al primer cliente en espera compatible.
- Depósito previo obligatorio para clientes con historial de inasistencias (no-show), con liberación automática si no se paga a tiempo.
- Clasificación y seguimiento de no-shows por cliente.
- Reservas recurrentes ("todos los jueves a las 18:00").
- Programa de fidelidad: descuento automático cada 10 cortes completados.
- Mensaje automático de cumpleaños con descuento.
- Campañas de horas vacías ("Hoy quedó libre un turno a las 16:30") a los últimos clientes de la sucursal.
- Sincronización opcional por peluquero con Google Calendar (OAuth2).
- Gestión de varias sucursales (una instancia de bot por número de WhatsApp, un panel compartido).
- Modo Shabat por sucursal: cerrado (no se reserva), silencioso (se reserva pero el aviso al peluquero se retiene hasta Motzaei Shabat, usando horarios reales de Hebcal) o desactivado.
- App de administración (Expo) rediseñada: agenda diaria, lista de espera, clientes (con inasistencias y fidelidad), campañas, horarios/días bloqueados por peluquero, sucursales, servicios y configuración.

## [1.0.0] - 2026-05-07

### Added
- React Native + Expo mobile app in Hebrew (RTL) for yeshiva administrators
- WhatsApp group contact extraction via Baileys unofficial bot
- Firebase Firestore storage with public read / admin-only write rules
- Contact classification by category (8 trades) and zone (7 cities + nationwide)
- Global search across name, phone, review, and recommender fields
- Direct WhatsApp deep-link button on every contact card
- Admin panel: login, approve/edit/delete pending contacts
- Daily cron sync via node-cron (02:00 IL time)
