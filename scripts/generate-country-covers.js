#!/usr/bin/env node
// Genera una foto de portada con IA (Grok/xAI) para cada país "sin fotos"
// que todavía no tenga `coverUrl` en data.json, y la sube a Cloudinary.
// Reemplaza el relleno de Picsum (random, sin relación con el país) en la
// grilla "Visitados — fotos por subir" del sitio.
//
// Solo procesa países SIN coverUrl — correrlo de nuevo más adelante (ej.
// cuando se agregue un país nuevo a visitedEmpty) es seguro y no gasta de
// más ni regenera lo que ya existe.
//
// Requiere un archivo .env en la raíz del repo con:
//   XAI_API_KEY=...
//   CLOUDINARY_CLOUD_NAME=...
//   CLOUDINARY_API_KEY=...
//   CLOUDINARY_API_SECRET=...
//
// Uso:
//   node scripts/generate-country-covers.js --dry-run    (solo muestra los prompts, no gasta nada)
//   node scripts/generate-country-covers.js              (genera todo lo que falte)
//   node scripts/generate-country-covers.js --limit=4    (solo los próximos 4 — tandas chicas, conexión inestable)
//   node scripts/generate-country-covers.js --only=turquia,japon

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const DATA_PATH = path.join(ROOT, 'data.json');

function loadEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  fs.readFileSync(filePath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  });
  return env;
}

const env = { ...loadEnv(ENV_PATH), ...process.env };
const { XAI_API_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : null;

if (!DRY_RUN && (!XAI_API_KEY || !CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET)) {
  console.error(
    'Faltan variables en .env: XAI_API_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET'
  );
  process.exit(1);
}

// Un lugar/paisaje icónico y reconocible del país, foto realista, sin texto
// ni gente en primer plano — es una portada de "todavía no subí fotos acá",
// no se vende ni se hace pasar por foto real de Mario.
function promptFor(country) {
  const name = country.nameEn || country.name;
  return (
    `Professional travel photograph representative of ${name}: an iconic landmark or ` +
    `characteristic landscape of the country, golden hour lighting, shot on a DSLR camera, ` +
    `high detail, photorealistic, no text, no watermark, no logos, no people in the foreground.`
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Un error que reintentar no va a arreglar (clave inválida, sin saldo,
// prompt rechazado por política de contenido) — withRetry lo deja pasar
// directo, y main() corta el lote entero en vez de seguir gastando
// intentos contra la misma pared en cada país que sigue.
class PermanentError extends Error {}

// La generación de imagen tarda y de vez en cuando la conexión se corta
// sola a mitad de camino (SocketError: other side closed, o un corte del
// otro lado a los ~60s sin error HTTP) — no es un error real de la
// request, así que reintenta antes de darla por perdida. La espera crece
// bastante entre intento e intento (5s, 15s, 45s) porque el corte
// observado no es un parpadeo de un segundo — puede durar varios minutos
// del lado de xAI, y una espera corta solo vuelve a pegar contra lo mismo.
async function withRetry(fn, attempts = 4, baseDelayMs = 5000) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof PermanentError) throw err;
      lastErr = err;
      if (i < attempts - 1) await sleep(baseDelayMs * Math.pow(3, i));
    }
  }
  throw lastErr;
}

// 401 (clave inválida), 402 (sin saldo) y 400 (prompt rechazado) no se
// arreglan reintentando la misma request — todo lo demás (5xx, timeouts,
// cortes de conexión) sí puede ser transitorio.
function xaiError(status, text) {
  const msg = `xAI ${status}: ${text.slice(0, 300)}`;
  return status === 401 || status === 402 || status === 400 ? new PermanentError(msg) : new Error(msg);
}

async function generateImage(prompt) {
  return withRetry(async () => {
    const res = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${XAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'grok-imagine-image-2.0', prompt }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw xaiError(res.status, text);
    }
    const json = await res.json();
    const item = json.data && json.data[0];
    if (!item) throw new Error('Respuesta de xAI sin data[0]: ' + JSON.stringify(json).slice(0, 300));
    if (item.url) return { kind: 'url', value: item.url };
    if (item.b64_json) return { kind: 'b64', value: item.b64_json };
    throw new Error('Respuesta de xAI sin url ni b64_json: ' + JSON.stringify(item).slice(0, 300));
  });
}

function cloudinarySignature(params, secret) {
  const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(sorted + secret).digest('hex');
}

async function uploadToCloudinary(image, publicId) {
  return withRetry(async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'cantbelievetheview/covers';
    const signature = cloudinarySignature({ folder, public_id: publicId, timestamp, overwrite: true }, CLOUDINARY_API_SECRET);

    const form = new FormData();
    form.append('file', image.kind === 'url' ? image.value : `data:image/png;base64,${image.value}`);
    form.append('folder', folder);
    form.append('public_id', publicId);
    form.append('timestamp', String(timestamp));
    form.append('overwrite', 'true');
    form.append('api_key', CLOUDINARY_API_KEY);
    form.append('signature', signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const msg = `Cloudinary ${res.status}: ${text.slice(0, 300)}`;
      // 401/403 acá es firma o api_key/secret mal — no cambia entre
      // intentos, así que reintentar es tan inútil como con xAI.
      throw res.status === 401 || res.status === 403 ? new PermanentError(msg) : new Error(msg);
    }
    return res.json();
  });
}

function coverUrlFor(publicId) {
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,g_auto,w_800,h_800,q_auto,f_auto/${publicId}`;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  let targets = data.visitedEmpty.filter((c) => !c.coverUrl);
  if (ONLY) targets = targets.filter((c) => ONLY.includes(c.key));
  if (LIMIT) targets = targets.slice(0, LIMIT);

  if (targets.length === 0) {
    console.log('Nada para generar — todos los países ya tienen coverUrl (o --only no matcheó ninguno).');
    return;
  }

  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}${targets.length} país(es) sin portada:\n`);

  let done = 0;
  let stoppedEarly = false;
  for (const country of targets) {
    const label = `${country.name} (${country.key})`;
    const prompt = promptFor(country);
    if (DRY_RUN) {
      console.log(`- ${label}\n  "${prompt}"\n`);
      continue;
    }
    try {
      process.stdout.write(`- ${label}... `);
      const image = await generateImage(prompt);
      const publicId = `cover-${country.key}`;
      const uploaded = await uploadToCloudinary(image, publicId);
      country.coverUrl = coverUrlFor(uploaded.public_id);
      done++;
      console.log('OK');
    } catch (err) {
      console.log('FALLÓ: ' + err.message);
      // Sin saldo, clave inválida o prompt rechazado: seguir con el resto
      // del lote solo repite el mismo error país por país. Se corta acá,
      // se guarda lo que sí se generó, y se sale con un código distinto
      // (2) para que quien llame a esto (ej. la tarea programada) sepa
      // que hace falta que alguien mire esto, no que reintente solo.
      if (err instanceof PermanentError) {
        stoppedEarly = true;
        break;
      }
    }
  }

  if (DRY_RUN) {
    console.log(`Costo estimado: ~$${(targets.length * 0.04).toFixed(2)} USD (a $0.04/imagen). Nada se generó todavía.`);
    return;
  }

  if (done > 0) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n');
    console.log(`\nListo — ${done}/${targets.length} portadas generadas y guardadas en data.json.`);
  } else {
    console.log('\nNinguna portada se generó — revisá los errores de arriba.');
  }

  if (stoppedEarly) {
    console.log('\n⛔ Cortado antes de terminar el lote — el último error no se arregla reintentando. Revisar a mano.');
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
