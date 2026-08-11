# MemoraBet Solo

Version simplificada e independiente de MemoraBet.

## Alcance

- Juego de memoria en modo solitario.
- Ranking solitario local guardado en el navegador.
- Configuracion de audio, idioma e informacion legal.

No incluye autenticacion, tienda, perfil, amigos, historial, monedas, recompensas, duelos ni juego online.

## Archivos principales

- `index.html`: estructura de las vistas Juego, Ranking y Configuracion.
- `style.css`: diseno visual de la version solitaria.
- `main.js`: punto de entrada.
- `game.js`: logica de partida solitaria.
- `ui.js`: renderizado de tablero, ranking y navegacion.
- `state.js`: estado compartido minimo.
- `constants.js`: cartas y limites del juego.
- `utils.js`: funciones auxiliares.
- `audio.js`: musica, efectos y controles de volumen.
- `i18n.js`: textos traducibles.

## Ejecutar localmente

```bash
npm start
```

El servidor local imprime una URL similar a:

```txt
http://127.0.0.1:4173/index.html
```

No abras `index.html` con doble clic: los modulos ES necesitan servirse por HTTP.
