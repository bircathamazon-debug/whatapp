# Panel simulado de compradores: 4 segmentos (12-11-2026)

> **Aviso:** son 80 compradores **simulados** (20 por segmento), armados con
> la skill founder-consumer a partir de la investigación de precios
> (`reports/Precio del bot Israel Venezuela España.md`). Sirve para ver
> objeciones y elegir qué probar. **No son clientes reales ni testimonios.**
> Hay que confirmarlo con personas de verdad (el test con dinero real), no
> con esto.

## Resultado en una tabla

| Segmento | Precio probado | Compran | Razón principal del "no" | Rango aceptable (Van Westendorp) | ¿El precio entra? |
|---|---|---:|---|---|---|
| España (barberías y manicuristas) | €29 + IVA | 4/20 (20 %) | Costumbre (13): ya pagan Booksy u otra app | €8 – €35 | Sí, en la parte alta |
| Israel, barberías religiosas | ₪99 + IVA | 0/20 (0 %) | Costumbre (14): van por orden de llegada, teléfono kasher | ₪31 – ₪110 | Sí, casi en el techo |
| Israel, manicuristas | ₪99 + IVA | 4/20 (20 %) | Costumbre (9) y precio (5) | ₪30 – ₪120 | Sí |
| Venezuela (Caracas) | US$19 | 1/20 (5 %) | Precio (10): "son 4 o 5 cortes míos" | US$4 – US$15 | **No, está por encima** |

Las respuestas de precio de cada segmento están en `founder/<segmento>/pricing-curve.md`,
y el detalle con citas en `founder/<segmento>/panel/results.md`.

## Lo que se repite en los 4 segmentos

1. **"No tengo tiempo de configurarlo".** Casi todos los que dudan dicen que
   lo usarían si se lo entregan ya armado (servicios, horarios, precios
   cargados). La herramienta `/nuevo-cliente` y el alta automática apuntan
   justo a esto.
2. **"Mis clientes, ¿van a querer hablar con un bot?"** Se resuelve
   mostrando el bot funcionando en vivo, en su idioma, y la opción de
   pasarle la charla a una persona.
3. **La recomendación de un colega** pesa más que cualquier anuncio,
   sobre todo en Israel religioso y en Venezuela.

## Por segmento

- **Israel, barberías religiosas (0/20):** el problema no es el precio, es
  el modelo de trabajo: muchas atienden por orden de llegada y la clientela
  usa teléfono kasher. Para ellos lo vendible es la **línea telefónica
  (IVR)** y un **modo de fila de espera** (walk-in), más varios chicos
  seguidos en una sola reserva y un aviso claro de que no se manda nada en
  Shabat. Antes de venderles hay que probar de verdad que un teléfono
  kasher puede llamar al 076.
- **Israel, manicuristas (4/20):** el mejor segmento de Israel. Las que ya
  pagan otra app solo cambiarían si les migran la agenda y cuesta menos.
  Las que trabajan solas piden algo cerca de ₪50.
- **España (4/20):** el precio entra en el rango; el freno es que ya pagan
  Booksy/Treatwell y dudas sobre protección de datos (RGPD).
- **Venezuela (1/20):** US$19 está por encima de lo que acepta la mayoría.
  La única compra fue una barbería media/premium (corte US$8-20). Los
  barberos de barrio (US$3-7) y los que atienden sin turnos no son cliente.
  Además, los cortes de luz e internet generan desconfianza.

## Qué sugiere probar con gente real

| Segmento | Sugerencia para el test real |
|---|---|
| Israel barberías | No salir con ₪99 a cualquiera: buscar primero las que ya dan turnos, y llevar la línea telefónica como argumento principal |
| Israel manicuristas | ₪99 se puede probar; tener un plan más chico (~₪49-59, pocas citas) para las que trabajan solas |
| España | €29 + IVA está bien para probar; preparar la respuesta de RGPD |
| Venezuela | Probar **US$9-12** y solo con barberías de corte US$10+ (el cliente ideal ya definido) |

Ningún precio se cambió en el código: `functions/src/plans.ts` sigue con
₪99/₪150. Es una decisión del usuario.
