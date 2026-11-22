# התמונות שלנו · Galería privada de fotos (hebreo, RTL)

Álbum compartido para un grupo de amigas. Las fotos viven en la nube (Cloudflare R2) y se ven desde cualquier teléfono, sin ocupar espacio. Cada niña entra con su código personal, o simplemente acercando su llavero NFC.

## Quién puede hacer qué

| Rol | Cómo entra | Qué puede hacer |
|---|---|---|
| **אחראית** (administradora, solo una) | `ADMIN_PIN` | Todo. Además crea y cancela códigos para las demás. |
| **עוזרת** (ayudante) | Código creado por la administradora | Ver, subir, mover fotos entre categorías, borrar y crear categorías. |
| **חברה** (amiga) | Código creado por la administradora | Ver, subir y borrar **sus propias** fotos. |

La administradora abre **"ניהול גישה"**, escribe el nombre de la amiga, elige el tipo y recibe un código de 6 dígitos con un **enlace directo** (`https://tusitio.pages.dev/?c=123456`). Si una amiga pierde el llavero o el teléfono, se cancela su código y se crea otro. Las demás no se ven afectadas.

## Publicar en Cloudflare (una sola vez)

Necesitas una cuenta gratuita de Cloudflare y Node.js 18 o superior.

```bash
cd fotos
npm install
npx wrangler login

# 1. Crear el espacio de almacenamiento de fotos
npx wrangler r2 bucket create tmunot-photos

# 2. Crear el proyecto y publicar
npx wrangler pages project create tmunot --production-branch main
npm run deploy

# 3. Poner el PIN de la administradora (secreto, no se guarda en el código)
npx wrangler pages secret put ADMIN_PIN --project-name tmunot
```

Después, en el panel de Cloudflare: **Workers & Pages → tmunot → Settings → Bindings → R2 bucket**. Agrega el binding `PHOTOS` apuntando a `tmunot-photos`, y vuelve a ejecutar `npm run deploy`.

Tu sitio quedará en `https://tmunot.pages.dev`. Más adelante puedes conectar un dominio propio desde el mismo panel.

## Alternativa sin terminal: subir un zip por el panel

1. Ejecuta `./build-zip.sh` (o usa el `tmunot-cloudflare.zip` ya generado).
2. Cloudflare → **Workers & Pages → Create → Pages → Upload assets**. Nombre del proyecto: `tmunot`. Sube el zip y pulsa **Deploy**.
3. Abre el proyecto → **Settings → Bindings → Add → R2 bucket**: variable `PHOTOS`, bucket `tmunot-photos` (créalo antes en **R2 → Create bucket**).
4. **Settings → Variables and Secrets → Add**: nombre `ADMIN_PIN`, tipo *Secret*, y el PIN de la administradora.
5. Vuelve a subir el zip (**Deployments → Create new deployment**) para que tome los cambios del 3 y el 4.

### Seguridad recomendada
- Elige un `ADMIN_PIN` largo (8 dígitos o más). Los códigos de las amigas son de 6 dígitos y es el enlace el que se comparte, no el código escrito a mano.
- En Cloudflare, **Security → WAF → Rate limiting**: limita `POST /api/login` a unos 10 intentos por minuto por IP. Así nadie puede adivinar códigos.

## Probar en tu computadora

```bash
echo 'ADMIN_PIN=123456' > .dev.vars
npm run dev      # http://localhost:8788
```

## Llaveros NFC

El chip NFC **no guarda las fotos**, guarda solo un enlace. Las fotos están en la nube.

1. En la app, la administradora crea el código de cada niña y pulsa **"העתקת קישור"**.
2. En un teléfono Android, instala la app gratuita **NFC Tools**, elige *Write → Add a record → URL* y pega el enlace.
3. Acerca el chip para grabarlo. Listo: al acercar el llavero a cualquier teléfono se abre el álbum con la sesión iniciada.

Recomendaciones: usa etiquetas NTAG215 o NTAG216 (aprox. 1 USD cada una). El enlace queda grabado, así que si quieres cambiar el acceso de esa niña, cancela su código y graba uno nuevo.

## Cómo suben las fotos

- **Botón "העלאת תמונות"**: elige varias fotos de la galería o toma una con la cámara. Funciona en cualquier teléfono.
- **Como app (PWA)**: en Chrome, "Agregar a pantalla de inicio". En **Android** la app aparece también en el menú *Compartir* de la galería, así se mandan fotos directo, como se hace con WhatsApp. En iPhone se sube con el botón.
- Antes de subir, cada foto se reduce en el teléfono (máx. 2000 px, JPEG) y se crea una miniatura. Así se sube rápido y se ocupa poco espacio en la nube.

## Categorías

Fijas: חברות · משפחה · שבת וחגים · טיולים · סלפי · זכרונות.
La administradora y las ayudantes pueden crear más (יום הולדת, סמינר, מחנה קיץ…). La página sugiere ideas al crearlas.

## Estructura

```
fotos/
├── public/                 Web estática (HTML, CSS, JS), app instalable
│   ├── index.html  style.css  app.js
│   ├── sw.js  manifest.webmanifest  icon.svg
├── functions/api/[[path]].js   API (Cloudflare Pages Function + R2)
└── wrangler.toml           Configuración de Cloudflare
```

## Costo aproximado
Cloudflare Pages es gratis. R2 incluye 10 GB gratis al mes y no cobra por descargas. Con fotos reducidas, caben miles de fotos dentro del plan gratuito.
