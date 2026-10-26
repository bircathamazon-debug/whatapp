---
name: investigar-palabras-clave
description: Investigación de palabras clave (SEO) con datos gratis de Google para el bot de citas o para un cliente — autocompletado real + Google Trends + intención de búsqueda, y explica por qué se elige cada palabra con números. Usar cuando el usuario pida palabras clave, "qué busca la gente", ideas de páginas o guías, o comparar demanda entre países.
---

# Investigar palabras clave

El usuario está aprendiendo marketing (el asistente es su mentor, ver CLAUDE.md):
cada resultado se entrega **explicado en simple**, con el porqué de cada elección y
los números que lo respaldan. Nunca inventar volúmenes.

## Paso a paso

1. **Semillas**: 8–12 frases cortas con las que un dueño de negocio buscaría lo que
   hace el bot (ej. "agenda para barberia", "chatbot whatsapp", "recordatorio de citas").
   Si el usuario aporta palabras de la gente del lugar (familia, clientes), van primero.
2. **Correr el script** (necesita `python3 -m pip install pytrends`):
   ```
   python3 .claude/skills/investigar-palabras-clave/scripts/palabras_clave.py \
     --geo VE --semillas "agenda para barberia" "chatbot whatsapp" ... \
     --temas "app para barberos" "software para barberia" "chatbot whatsapp" "whatsapp business" ... \
     --obligatorias barber peluquer salon uñas estetic cita agenda turno reserva whatsapp bot chatbot recordatorio \
     --salida <carpeta>
   ```
   - `--geo`: país (VE, MX, PA). `--ancla`: término de referencia de Trends (por
     defecto "bot de whatsapp" = 100); usar siempre el mismo ancla para poder comparar.
   - `--temas`: términos **cortos** a medir en Trends. Las frases largas casi nunca
     tienen datos suficientes: se usan como ideas de contenido, no se miden.
   - `--volumenes`: CSV exportado del Planificador de palabras clave de Google Ads
     (gratis con cuenta de Ads) para sumar el volumen mensual real.
   - Trends a veces pide esperar (error 429): el script reintenta solo. Tarda 2–5 min.
3. **Leer `palabras_clave.csv` y `temas_trends.csv`** y elegir.

## Cómo elegir (y explicarlo)

Cada palabra elegida tiene que pasar 4 filtros, y la explicación los nombra:
1. **Quién busca**: ¿la escribe un *dueño* (posible cliente) o un *consumidor*?
   "app para barberos" = dueño; "app para buscar barberos" o "barbería caracas" = consumidor (descartar).
2. **Significa lo que creemos**: buscarla en Google y mirar qué aparece. Trampas
   conocidas: "app para citas" = citas de pareja; "organizar citas" = citas bibliográficas;
   "sistema de citas" = trámites (pasaporte, consulado).
3. **Señal de demanda** (los números): índice de Trends contra el ancla y cuántas
   veces aparece en el autocompletado (apariciones / mejor posición). 0 en Trends =
   "muy pocas búsquedas para que Google lo mida", no "nadie la busca".
4. **Tenemos algo que decir**: una función real del bot o experiencia del piloto.

Asignar cada palabra a una página (inicio, precios, función, rubro, comparación, guía)
según su intención: transaccional → producto/precios; comparativa → comparación o
página de rubro; informativa → guía.

## Límites que hay que decirle al usuario

- El autocompletado mezcla sugerencias de otros países aunque se pida uno.
- Trends da números **relativos** (contra el ancla), no búsquedas por mes, y trabaja
  con muestras: dos corridas pueden variar un poco.
- El volumen absoluto sale solo del Planificador de Google Ads (o de herramientas
  pagas como Semrush, Ahrefs, Ubersuggest o el plugin HarborRank).
- Guardar los resultados en `research_notes/` con la fecha.
