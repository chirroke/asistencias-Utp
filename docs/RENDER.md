# Publicar en Render

Se propone un Web Service Node que sirve frontend, API y WebSocket en una sola URL HTTPS, junto con PostgreSQL. La configuración está en `render.yaml`. No usa un Static Site separado.

## 1. Base de datos

En Render, crea o selecciona una PostgreSQL para este proyecto. Recomendación para el esquema incluido: PostgreSQL 18. Coloca el servicio web y la base en la misma región.

- Base nueva y vacía: ejecuta `database/schema.sql` desde tu PC con `psql` 18 y los datos de conexión externa de Render. Usa `-v ON_ERROR_STOP=1 --single-transaction` y deja que pida la contraseña.
- Base con respaldo restaurado: conserva los datos y revisa las migraciones `001` a `006` de `backend/migrations`. No ejecutes el esquema inicial encima de tablas existentes.
- El repositorio incluye estructura, no las cuentas ni asistencias privadas de la PC. Configura cuentas de demostración en la base nueva usando el seed desde tu PC y una contraseña elegida por ti.

Ejemplo de importación, reemplazando los campos por los de Render:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h HOST_EXTERNO -p 5432 -U USUARIO -d BASE -v ON_ERROR_STOP=1 --single-transaction -f database/schema.sql
```

La conexión desde tu PC usa el host externo y TLS. En el backend puedes usar una `DATABASE_URL` externa con `DB_SSL=true`; la URL no debe incluir opciones SSL que contradigan esa configuración. No publiques la URL con contraseña.

## 2. Servicio web

En Render selecciona **New > Web Service**, conecta `chirroke/asistencias-Utp` y configura:

| Campo | Valor |
| --- | --- |
| Branch | `main` |
| Root Directory | vacío (raíz del repositorio) |
| Runtime | Node |
| Build Command | `npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Node | rama 22, indicada en `.node-version` |

También puedes usar **New > Blueprint** y seleccionar el repositorio para aplicar `render.yaml`. El archivo no crea automáticamente una base ni ejecuta el seed.

Configura las variables privadas:

| Variable | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | URL interna de la base Render, en la misma región |
| `DB_SSL` | `false` para la URL interna; `true` al usar una conexión externa TLS |
| `JWT_SECRET` | cadena aleatoria privada. Blueprint la genera automáticamente |
| `FRONTEND_ORIGINS` | origen HTTPS exacto asignado al servicio, sin barra final |
| `RIESGO_MIN_SESIONES` | `4` |
| `RIESGO_ADVERTENCIA_PCT` | `20` |

No configures `VITE_API_URL` con localhost en Render. El valor predeterminado `/api` permite que el navegador use la misma URL del sitio. Render asigna `PORT`.

## 3. Validación tras publicar

1. Confirma que Render muestre **Live** para el commit que acabas de subir.
2. Abre `/api/health`: debe devolver HTTP 200 con `database: connected`. Eso prueba conexión, no la existencia de todas las tablas.
3. Inicia sesión en los tres roles y comprueba cursos y matrículas.
4. Abre una clase, escanea desde un celular usando la URL HTTPS y verifica selfie y actualización en vivo.
5. Comprueba el cierre, la falta, una justificación y la descarga Excel/PDF desde el historial.
6. Refresca una ruta interna como `/docente` para comprobar que el frontend sigue cargando.

## Límites del plan gratuito

Render Free suspende el Web Service tras 15 minutos sin tráfico; el primer acceso puede tardar cerca de un minuto. Mientras el proceso duerme no corre el temporizador local de cierre. Para una demostración abre el sistema antes de empezar y verifica los horarios pendientes. PostgreSQL Free vence a los 30 días y no incluye backups administrados. Guarda respaldos externos. Los puertos SMTP 25, 465 y 587 están bloqueados en Web Services gratuitos, por lo que la recuperación por correo actual requiere otro plan o adaptación a una API de correo.

Documentación oficial consultada: [Express](https://render.com/docs/deploy-node-express-app), [PostgreSQL](https://render.com/docs/postgresql-creating-connecting), [Blueprint](https://render.com/docs/blueprint-spec), [límites Free](https://render.com/docs/free).
