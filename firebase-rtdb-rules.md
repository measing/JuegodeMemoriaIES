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
            ".validate": "newData.hasChildren(['id', 'name', 'tiempoMs', 'intentos', 'completedAt', 'source']) && newData.child('id').isString() && newData.child('name').isString() && newData.child('tiempoMs').isNumber() && newData.child('tiempoMs').val() >= 0 && newData.child('intentos').isNumber() && newData.child('intentos').val() >= 1 && newData.child('intentos').val() <= 10 && newData.child('completedAt').isNumber() && newData.child('source').val() === 'solo'"
          }
        }
      }
    },
    "public": {
      "soloLeaderboard": {
        ".read": true,
        ".write": false
      }
    },
    ".read": false,
    ".write": false
  }
}
```

## Rutas usadas por la app

- Ranking sincronizado por usuario: `users/{uid}/soloLeaderboard`.
- Ranking global publico: la app actual no escribe aqui; queda solo lectura para una futura vista global.

Si Firebase no esta disponible o el usuario no inicia sesion, el juego conserva el ranking local en el navegador.
