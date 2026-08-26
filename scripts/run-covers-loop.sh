#!/bin/bash
# Genera las portadas con IA de a una, comiteando y pusheando cada una en el
# momento que sale — así nada se pierde si la conexión se corta a mitad de
# camino, y no hay que esperar a que termine un lote entero para ver avance.
# Antes de cada país, hace git pull — si el bot subió una foto real mientras
# tanto (y un país migró de "sin fotos" a "visitado"), trabaja siempre sobre
# la versión más fresca en vez de pisarla.
set -e
cd /Users/mario/Desktop/AzerIA/proyectos/cantbelievetheview/sitio

while true; do
  git pull origin main --quiet

  remaining=$(node -e "const d=require('./data.json'); console.log(d.visitedEmpty.filter(c=>!c.coverUrl).length)")
  if [ "$remaining" -eq 0 ]; then
    echo "✅ Listo — no quedan países sin portada."
    break
  fi
  echo "--- Quedan $remaining países sin portada. Generando 1... ---"

  # Sin "|| true" acá, set -e cortaría el script entero en el primer país
  # que falle sin dejar rastro de por qué — capturamos el código a mano
  # para distinguir "no se arregla reintentando" (2, ver PermanentError en
  # el script) de un fallo transitorio, que el script ya reintentó solo
  # varias veces antes de rendirse por esta vuelta.
  node scripts/generate-country-covers.js --limit=1 || covers_exit=$?
  if [ "${covers_exit:-0}" -eq 2 ]; then
    echo "⛔ Corte definitivo (clave inválida, sin saldo, o prompt rechazado) — no tiene sentido seguir reintentando solo. Avisar a Mario."
    exit 2
  fi
  covers_exit=0

  if ! git diff --quiet data.json; then
    country=$(git diff data.json | grep -m1 '"coverUrl"' | sed -E 's/.*cover-([a-z-]+)".*/\1/')
    # git add -A (no solo data.json) — si queda cualquier otro cambio suelto
    # sin comitear (ej. una edición al propio script), bloquea el rebase de
    # la vuelta siguiente y el commit de la portada se queda sin subir.
    git add -A
    git commit -m "Portada IA generada: ${country:-país nuevo} (tanda automática de a 1)" --quiet
    git pull origin main --rebase --quiet
    git push origin main --quiet
    echo "✅ Commiteado y pusheado."
  else
    echo "⚠️ No se generó nada esta vez (falló) — reintento en la próxima vuelta."
  fi

  sleep 8
done
