# Firebase para Solitario UCM

La app usa Firebase Web SDK modular para Authentication y Realtime Database. No requiere service accounts ni credenciales privadas.

## Activar en Firebase Console

1. En Authentication > Sign-in method, habilita Email/Password.
2. En Authentication > Sign-in method, habilita Google.
3. En Authentication > Settings > Authorized domains, confirma `localhost`, `127.0.0.1` y el dominio final donde publiques la app.
4. En Realtime Database, crea la base de datos del proyecto `juegodememoriaies` y pega reglas similares a estas:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid",
        "soloLeaderboard": {
          "$entryId": {
            ".validate": "newData.hasChildren(['id', 'name', 'tiempoMs', 'intentos', 'pairs', 'completed', 'completedAt', 'source']) && newData.child('id').isString() && newData.child('name').isString() && newData.child('tiempoMs').isNumber() && newData.child('tiempoMs').val() >= 0 && newData.child('intentos').isNumber() && newData.child('intentos').val() >= 1 && newData.child('intentos').val() <= 10 && newData.child('pairs').isNumber() && newData.child('pairs').val() >= 0 && newData.child('pairs').val() <= 8 && newData.child('completed').isBoolean() && newData.child('completedAt').isNumber() && newData.child('source').val() === 'solo'"
          }
        },
        "soloStats": {
          ".validate": "newData.hasChildren(['games', 'totalPairs', 'best', 'averagePairs', 'updatedAt']) && newData.child('games').isNumber() && newData.child('games').val() >= 0 && newData.child('totalPairs').isNumber() && newData.child('totalPairs').val() >= 0 && newData.child('best').isNumber() && newData.child('best').val() >= 0 && newData.child('best').val() <= 8 && newData.child('averagePairs').isNumber() && newData.child('averagePairs').val() >= 0 && newData.child('averagePairs').val() <= 8 && newData.child('updatedAt').isNumber()"
        }
      }
    },
    "public": {
      "soloLeaderboard": {
        ".read": true,
        ".write": false
      }
    },
    "publicSoloLeaderboard": {
      ".read": true,
      "$uid": {
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "newData.hasChildren(['alias', 'pairs', 'tiempoMs', 'intentos', 'score', 'updatedAt']) && newData.child('alias').isString() && newData.child('pairs').isNumber() && newData.child('pairs').val() >= 0 && newData.child('pairs').val() <= 8 && newData.child('tiempoMs').isNumber() && newData.child('tiempoMs').val() >= 0 && newData.child('intentos').isNumber() && newData.child('intentos').val() >= 1 && newData.child('intentos').val() <= 10 && newData.child('score').isNumber() && newData.child('updatedAt').isNumber()"
      }
    },
    ".read": false,
    ".write": false
  }
}
```

## Rutas usadas por la app

- Ranking sincronizado por usuario: `users/{uid}/soloLeaderboard`.
- Estadisticas de perfil por usuario: `users/{uid}/soloStats`.
- Ranking global publico en tiempo real: `publicSoloLeaderboard/{uid}`.

La entrada global solo guarda alias visible, pares, tiempo, intentos, puntuacion y timestamp. No guarda correos ni datos privados en el valor publicado. La clave de la entrada usa el UID autenticado para que las reglas puedan impedir que un usuario sobrescriba la entrada de otro.

Importante: publica estas reglas actualizadas en Firebase Console para aceptar resultados terminados con menos de 8 pares y sincronizar `soloStats`. Si las reglas antiguas siguen activas, Firebase puede rechazar escrituras que incluyan `pairs`, `completed` o `soloStats`; el ranking local seguira funcionando en el navegador.

Si Firebase no esta disponible o el usuario no inicia sesion, el juego conserva el ranking local en el navegador y el panel en vivo muestra el fallback local.
