# cantbelievetheview — el sitio

**Vivo en https://cantbelievetheview.com.** El portafolio de fotografía de viajes de Mario,
y la tienda desde la que se venden las impresiones. HTML/CSS/JS puro, sin framework.

**Netlify, con despliegue automático en cada push a `main`.**

## `data.json` es el sitio

Todo el contenido sale de ahí: los países visitados, las galerías, los próximos destinos y
dónde está Mario ahora. Tres listas que importan:

| clave | qué es |
|---|---|
| `visited` | países ya visitados, con o sin galería |
| `upcoming` | próximos destinos, con `startsOn` y `endsOn` |
| `current` | dónde está ahora — o `"..."` |

⚠️ **`data.json` tiene dos escritores y ninguno es una persona:**

1. **El bot de Telegram**, que escribe las fotos nuevas a través de la API de GitHub
2. **La rutina `CBTV — Actualmente en`, que corre en la nube** y es la **dueña** de
   `current` y `upcoming`

Por eso la tarea local que hacía lo mismo está **pausada**: había dos dueños del archivo y
se pisaban. **No reactivarla sin apagar antes la de la nube.**

## El bloque "Actualmente en"

```
antes de la fecha de inicio  →  "Próximos destinos"   (upcoming)
desde la fecha de inicio     →  "Actualmente en: X"   (current)
al terminar                  →  "..."
```

Un viaje sale de `current` por lo que ocurra primero: llega su `endsOn` —contando el día
del regreso como terminado— o arranca el viaje siguiente.

**Los tres puntos son parte del diseño, no un estado vacío.** El bloque se muestra siempre.
Es privacidad: si solo apareciera cuando viaja, su ausencia diría que está en casa.

## Reglas del globo, fijadas por Mario

*"Indistintamente de que esté en ese país o no, no podemos tener ese efecto de globo ni que
se duplique el país."*

Cada país se dibuja **una sola vez**, con precedencia `current > upcoming > visitado`. La
deduplicación vive **en el arranque**, antes de que cualquier vista la use — no dentro del
bloque del globo. Ya falló una vez por eso: el titular decía 51 países y la grilla mostraba
52.

Y hay dos dimensiones que **no se mezclan**:

- **`type`** decide borde y click, y lo fija la primera lista que reclama el país (siempre
  se procesa `visited` primero)
- **`badge`** es solo información que se suma al tooltip

Así, **un país con galería real nunca pierde su borde ni su click por estar marcado como
actual.** En un sitio de fotografía, entrar a ver las fotos es el producto.

## Cosas que no se hacen aquí

🚫 **Cero fotos de stock.** Se sacó Picsum el 26 de agosto de 2026 porque contradecía el
BRIEF. Las portadas de países que no tienen galería se **generan por IA** con una rutina
diaria.

🔒 **Los viajes ocultos no se publican nunca** — ni como próximo destino, ni como
"actualmente en", ni mencionados. Viven en una carpeta aparte de la skill `kai` y la rutina
que publica tiene instrucción expresa de no entrar en subcarpetas. Si ves un viaje que no
está en `data.json`, **no lo agregues**.

## El repositorio es público

El bot escribe aquí desde fuera con un token de GitHub. **Nunca commitear credenciales.**
