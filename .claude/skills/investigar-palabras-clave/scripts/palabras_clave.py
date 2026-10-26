#!/usr/bin/env python3
"""
Investigación de palabras clave con fuentes gratis de Google.

1. Expande unas "semillas" con el autocompletado de Google (búsquedas reales).
2. Descarta lo que no es del nicho (palabras obligatorias / prohibidas).
3. Clasifica la intención de cada frase (informativa, comparativa, transaccional, local).
4. Mide el interés relativo en Google Trends contra una palabra "ancla" (ancla = 100).
5. Opcional: suma el volumen mensual real si se le pasa el CSV del
   Planificador de palabras clave de Google Ads (--volumenes).

Uso:
  python3 palabras_clave.py --geo VE --semillas "agenda para barberia" "bot de whatsapp" \\
      --obligatorias barber peluquer cita agenda whatsapp bot --salida resultados/
"""
import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

MODIFICADORES = ["", " para", " gratis", " precio", " como", " mejor", " app", " whatsapp"]

# Frases de otros nichos que aparecen seguido y confunden (salud pública, trámites, citas de pareja,
# citas bibliográficas). Se pueden sumar más con --prohibidas.
PROHIBIDAS_BASE = [
    "eps", "issste", "iess", "sura", "imss", "consulado", "visa", "pasaporte", "migracion", "saime",
    "ine", "dian", "fonacot", "semovi", "word", "bibliograf", "apa", "mujeres", "pareja", "amor",
    "canina", "perro", "stickers", "musica", "videos", "descargar musica",
]

# Se revisan en este orden: una pregunta ("cómo…") es informativa aunque diga "app".
INTENCION = [
    ("informativa", ["como", "cómo", "que es", "qué es", "para que sirve", "para qué sirve", "por que", "por qué", "ideas"]),
    ("transaccional", ["precio", "precios", "gratis", "comprar", "descargar", "costo", "cuanto cuesta", "cuánto cuesta"]),
    ("comparativa", ["mejor", "mejores", "vs", "alternativa", "alternativas", "comparar", "app", "aplicacion", "aplicación", "software", "sistema", "programa"]),
]


def autocompletar(q, geo, hl):
    url = "https://suggestqueries.google.com/complete/search?" + urllib.parse.urlencode(
        {"client": "firefox", "hl": hl, "gl": geo.lower(), "q": q})
    with urllib.request.urlopen(url, timeout=15) as r:
        return json.loads(r.read().decode("utf-8", "replace"))[1]


def intencion_de(frase, locales):
    # Por palabras enteras: "whatsapp" no tiene que contar como "app".
    f = " " + " ".join(re.findall(r"[\wáéíóúñü]+", frase.lower())) + " "
    if any(f" {l} " in f for l in locales):
        return "local"
    for nombre, marcas in INTENCION:
        if any(f" {m} " in f for m in marcas):
            return nombre
    return "general"


def expandir(semillas, geo, hl, obligatorias, prohibidas):
    vistas = {}
    for s in semillas:
        for mod in MODIFICADORES:
            try:
                sugerencias = autocompletar(s + mod, geo, hl)
            except Exception as e:  # una consulta fallida no frena el resto
                print(f"  aviso: autocompletado falló para '{s + mod}': {e}", file=sys.stderr)
                continue
            for pos, frase in enumerate(sugerencias):
                f = frase.lower().strip()
                if obligatorias and not any(o in f for o in obligatorias):
                    continue
                if any(p in f for p in prohibidas):
                    continue
                v = vistas.setdefault(f, {"frase": f, "apariciones": 0, "mejor_posicion": 99, "semilla": s})
                v["apariciones"] += 1
                v["mejor_posicion"] = min(v["mejor_posicion"], pos + 1)
            time.sleep(0.4)
    return list(vistas.values())


def medir_trends(frases, geo, ancla, meses):
    """Interés promedio de cada frase relativo al ancla (ancla = 100). 0 = Google no tiene datos suficientes."""
    try:
        from pytrends.request import TrendReq
    except ImportError:
        print("  aviso: falta pytrends (python3 -m pip install pytrends); se omite Trends", file=sys.stderr)
        return {}
    p = TrendReq(hl="es-419", tz=240)
    resultado = {}
    for i in range(0, len(frases), 4):
        lote = frases[i:i + 4]
        for intento in range(3):
            try:
                p.build_payload([ancla] + lote, geo=geo, timeframe=f"today {meses}-m")
                df = p.interest_over_time()
                break
            except Exception as e:
                print(f"  aviso: Trends pidió esperar ({e}); reintento en 30 s", file=sys.stderr)
                time.sleep(30)
        else:
            continue
        if df.empty:
            for f in lote:
                resultado[f] = 0.0
            continue
        medias = df.mean(numeric_only=True)
        a = medias.get(ancla, 0)
        for f in lote:
            resultado[f] = round(100 * medias.get(f, 0) / a, 1) if a else 0.0
        time.sleep(8)
    return resultado


def leer_volumenes(ruta):
    """CSV exportado del Planificador de palabras clave (columnas Keyword y Avg. monthly searches, o en español)."""
    vol = {}
    with open(ruta, encoding="utf-8-sig") as fh:
        for fila in csv.DictReader(fh):
            clave = (fila.get("Keyword") or fila.get("Palabra clave") or "").lower().strip()
            v = fila.get("Avg. monthly searches") or fila.get("Promedio de búsquedas mensuales") or ""
            if clave:
                vol[clave] = v
    return vol


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--semillas", nargs="+", required=True)
    ap.add_argument("--geo", default="VE", help="País en código de 2 letras (VE, MX, PA)")
    ap.add_argument("--hl", default="es-419")
    ap.add_argument("--obligatorias", nargs="*", default=[])
    ap.add_argument("--prohibidas", nargs="*", default=[])
    ap.add_argument("--locales", nargs="*", default=["caracas"], help="Palabras de lugar que marcan intención local")
    ap.add_argument("--ancla", default="bot de whatsapp")
    ap.add_argument("--meses", type=int, default=12)
    ap.add_argument("--temas", nargs="*", default=None,
                    help="Términos cortos a medir en Trends (por defecto, las semillas). Las frases largas casi "
                         "nunca tienen datos suficientes en Trends: se miden los temas y las frases largas se "
                         "usan como ideas de contenido.")
    ap.add_argument("--volumenes", help="CSV del Planificador de palabras clave de Google Ads")
    ap.add_argument("--salida", default="resultados")
    a = ap.parse_args()

    prohibidas = PROHIBIDAS_BASE + [p.lower() for p in a.prohibidas]
    print(f"1/3 Autocompletado de Google ({a.geo}) para {len(a.semillas)} semillas…", file=sys.stderr)
    filas = expandir(a.semillas, a.geo, a.hl, [o.lower() for o in a.obligatorias], prohibidas)
    filas.sort(key=lambda r: (-r["apariciones"], r["mejor_posicion"]))
    print(f"   {len(filas)} frases del nicho", file=sys.stderr)

    print(f"2/3 Google Trends contra el ancla '{a.ancla}'…", file=sys.stderr)
    temas = a.temas if a.temas is not None else a.semillas
    trends = medir_trends(temas, a.geo, a.ancla, a.meses)

    vol = leer_volumenes(a.volumenes) if a.volumenes else {}
    for r in filas:
        r["intencion"] = intencion_de(r["frase"], [l.lower() for l in a.locales])
        r["trends_vs_ancla"] = trends.get(r["frase"], "")  # solo si la frase es también un tema medido
        r["volumen_mensual"] = vol.get(r["frase"], "")

    print("3/3 Guardando…", file=sys.stderr)
    os.makedirs(a.salida, exist_ok=True)
    campos = ["frase", "intencion", "apariciones", "mejor_posicion", "trends_vs_ancla", "volumen_mensual", "semilla"]
    with open(os.path.join(a.salida, "palabras_clave.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=campos)
        w.writeheader()
        w.writerows({k: r.get(k, "") for k in campos} for r in filas)
    with open(os.path.join(a.salida, "temas_trends.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["tema", f"interes_vs_{a.ancla}"])
        w.writerows(sorted(trends.items(), key=lambda kv: -kv[1]))
    print(json.dumps({"geo": a.geo, "ancla": a.ancla, "temas": trends, "frases": filas}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
