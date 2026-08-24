# cantbelievetheview.com — Brief de proyecto

Sitio de fotografía de viaje de Mario Mazzone (@cantbelievetheview en Instagram). Portfolio + e-commerce de fotos digitales e impresiones, con un globo 3D interactivo como forma principal de navegación.

**Filosofía de marca**: "No tomo una fotografía. La pido prestada, en silencio." — tono contemplativo, minimalista, editorial.

---

## 1. Estado actual

- **Arquitectura**: un único archivo HTML autocontenido (`index.html`) — HTML + CSS + JS vanilla, sin build step, sin framework, sin dependencias de paquetes (todo vía `<script src>` de CDN: Three.js, topojson-client).
- **Deploy actual**: Netlify, vía **drag-and-drop manual** de `index.html` en app.netlify.com/drop (NO conectado a git todavía — esto es clave para el próximo paso, ver sección 5).
- **Dominio**: `cantbelievetheview.com` registrado en Namecheap, DNS apuntando a Netlify. Solo dominio, sin hosting contratado en Namecheap.
- **Sin backend, sin base de datos.** Todo el "contenido" (países, categorías, precios) son arrays de JavaScript embebidos en el propio HTML.

## 2. Qué tiene construido el sitio

- **Globo 3D (Three.js)**: textura satelital real de la Tierra (día/noche, nubes, atmósfera), rotación automática pausable, sin ningún punto/marca visible hasta que el mouse pasa sobre un país.
- **Fronteras reales**: carga en runtime un topojson mundial (`world-atlas` vía jsdelivr + `topojson-client`) y dibuja el borde real de cada país al hacer hover. Fallback a un óvalo aproximado para territorios muy chicos que no están en ese dataset (110m de resolución).
  - Borde **dorado brillante** = país con galería de fotos.
  - Borde **gris apagado** = país visitado sin fotos aún, o sin historia asociada (el resto del mundo).
- **Microestados**: Italia y Sudáfrica tienen un submenú al hacer click (San Marino/Vaticano; Lesoto) — mecanismo `MICROSTATES` en el JS, fácil de extender a otros países.
- **Sección Galería**: hub con 5 categorías (Blanco y Negro, Paisajes, Miscelánea, Ciudades, Modelos) + un 6to tile "Países" con submenú de todos los países agrupados en 3 secciones (Con galería / Visitados sin fotos / Próximos destinos).
- **Carrito de compras (DEMO, no real)**: agregar fotos en digital o impresión (2 materiales: papel algodón / aluminio, 3 tamaños S/M/L), vista previa de la impresión enmarcada en una mini-sala con muebles a escala real. Checkout con formulario, pero **no procesa pagos reales** — es una simulación.
- **Bilingüe** (ES/EN): sistema de diccionario `T = {es:{...}, en:{...}}` + función `t(key)`, botón de idioma en el nav y en todos los overlays.
- **Dos temas** (oscuro/claro): variables CSS que se togglean con clase `body.light`. El globo y su texto siempre se ven fijos en modo claro/blanco encima del canvas (decisión de diseño).
- **Marca de agua**: patrón repetido en diagonal sobre todas las fotos reales (SVG data-URI tileado, `mix-blend-mode: overlay`), para que no se pueda recortar y sacar la marca.
- **Sin fotos de stock**: se eliminaron todos los placeholders de Picsum. Donde no hay foto real, se muestra un bloque limpio "sin foto aún".

## 3. Modelo de datos (dentro del `<script>` del HTML)

```js
// Países CON galería de fotos reales (hoy vacío — honesto, sin fotos todavía)
var visited = [];

// Países visitados SIN fotos aún (49 países reales, de la app "Visited" de Mario,
// territorios agrupados en su país soberano, Inglaterra fusionada con Reino Unido)
var visitedEmpty = [
  {key:'argentina', name:'Argentina', lat:-38.0, lng:-63.6, w:14, h:34},
  // ... 48 más — key (slug), name (español), lat/lng (centro aprox.), w/h (tamaño del óvalo de respaldo en grados)
];

// Próximos destinos con fecha — VACÍO, pendiente que Mario elija sus próximos viajes reales
// (su lista "Want" en la app tiene 150+ destinos aspiracionales, no sirven todos para esto)
var upcoming = [];

// Categorías de la sección Galería
var categories = [
  {key:'bn', name:'Blanco y Negro', nameEn:'Black & White', desc:'...', descEn:'...', bw:true},
  // paisajes, misc, ciudades, modelos
];

var MATERIALS = [ /* algodón (base), aluminio (+45) */ ];
var SIZES = [ /* S 30x40 $120, M 50x70 $220, L 70x100 $380 */ ];

// Mapeo nombre español -> nombre en inglés usado por el dataset de fronteras (Natural Earth)
var NE_NAMES = { 'Argentina':'Argentina', 'Reino Unido':'United Kingdom', ... };
```

### Cómo se cargan fotos reales (mecanismo YA IMPLEMENTADO, listo para usar)

Cada país (en `visited`) o categoría puede tener un array `photos`:

```js
{
  key:'peru', name:'Perú', lat:-12.05, lng:-77.03, w:26, h:22,
  desc:'Andes, niebla y ruinas incas al amanecer.',
  descEn:'Andes, mist, and Inca ruins at dawn.',
  photos:[
    'https://res.cloudinary.com/.../peru-01.jpg',
    {url:'https://res.cloudinary.com/.../peru-02.jpg', caption:'Machu Picchu al amanecer', lat:-13.1631, lng:-72.5450}
  ]
}
```

- Si es un string, se usa como URL y el título se autogenera ("Perú · Estudio N").
- Si es un objeto, se puede pasar `caption` (título custom) y `lat`/`lng` (coordenada GPS real de esa foto puntual — si no se pasa, el sitio genera una coordenada aproximada cercana al país automáticamente).
- Un país pasa de `visitedEmpty` a `visited` (con galería) simplemente moviendo su objeto de un array al otro y agregándole `photos`, `desc`, `descEn`.
- Categorías: mismo mecanismo con el campo `photos` en el objeto de `categories`, más un campo `cover` (URL) para la portada del tile en el hub. Países también aceptan `thumb` (URL) para su miniatura en la grilla de Países.

## 4. Lo que falta para "terminar" el sitio (ver conversación previa completa)

1. **Contenido real**: fotos de Mario con su info (país, descripción, coords), portadas, próximos destinos reales.
2. **Pagos reales**: hoy el checkout es 100% falso. Falta Stripe o Mercado Pago (requiere backend, aunque sea mínimo — no alcanza con HTML estático).
3. **Legal/confianza**: página de contacto real, política de envíos, términos, email del dominio.
4. **Pulido técnico**: favicon, Open Graph/meta tags, SEO, analítica, compresión de imágenes.

## 5. Tarea actual: bot de Telegram para subir fotos

**Objetivo de Mario**: mandarle una foto (+ info) a un bot de Telegram, y que eso actualice el sitio automáticamente — sin tener que editar código a mano ni volver a arrastrar el archivo a Netlify.

### Prerrequisito importante
El sitio hoy se deploya arrastrando el archivo a mano en Netlify Drop. Para que un bot pueda "publicar" cambios solo, hace falta pasar a **deploy continuo por git**: crear un repo en GitHub con el `index.html`, conectar ese repo a Netlify (Netlify redeploya automático en cada push a `main`). Esto es un paso previo necesario antes de programar el bot.

### Arquitectura propuesta
```
Mario → Telegram (foto + texto) 
      → Bot (webhook, serverless: Vercel/Railway) 
      → Sube la foto a Cloudinary (URL pública)
      → Edita el array de datos correspondiente (agrega la foto al país/categoría, 
        o mueve el país de visitedEmpty a visited si es su primera foto)
      → Hace commit + push al repo de GitHub (API de GitHub, ej. Octokit)
      → Netlify detecta el push y redeploya solo
```

### Decisiones aún pendientes con Mario (retomar al empezar)
- ¿Cuenta de GitHub? (no confirmado si ya tiene una o hay que crear)
- ¿Cómo indica el país/categoría de cada foto al mandarla? (texto junto a la foto / el bot le pregunta paso a paso / que se adivine automático — esta última es poco confiable, no recomendada)
- ¿Dónde hostear el bot? (Vercel o Railway, sin definir aún)
- Necesita cuenta de Cloudinary (o similar) para alojar las imágenes — no confirmado si ya la tiene.
- Token del bot de Telegram: se genera hablándole a **@BotFather** en Telegram (`/newbot`).

### Cosas a tener en cuenta al programarlo
- El HTML es un solo archivo con TODO adentro (datos + lógica + estilos) — el bot va a tener que hacer una edición quirúrgica del array `visited`/`visitedEmpty`/`categories` dentro de ese archivo (con regex o, mejor, migrando esos arrays a un `data.json` separado que el HTML importe — recomendable hacer esto como parte de la migración a GitHub, para que el bot edite JSON en vez de tener que parsear JS embebido).
- Mantener el estilo de datos ya definido (ver sección 3) para no romper el resto del sitio (globo, hover, carrito, etc. dependen de esa forma exacta).
- Marca de agua, precios, materiales y toda la demás lógica del sitio no deberían tocarse — el bot solo necesita tocar los arrays de contenido.

---

*Este documento fue generado a partir de una conversación completa en claude.ai donde se construyó el sitio de punta a punta. Para dudas de diseño/decisiones ya tomadas, este brief resume el "por qué" de las cosas más importantes.*
